"""Cliente OCI de alto nivel para el MCP kidepik."""

from __future__ import annotations

import time
from typing import Any

import oci
from oci.exceptions import ServiceError

from env_loader import OciSettings, get_settings, oci_sdk_config

VCN_NAME = "kidepik-vcn"
SUBNET_NAME = "kidepik-subnet-public"
IGW_NAME = "kidepik-igw"
INSTANCE_NAME = "kidepik-mvp"
VCN_CIDR = "10.0.0.0/16"
SUBNET_CIDR = "10.0.1.0/24"
ARM_SHAPE = "VM.Standard.A1.Flex"
BOOT_VOLUME_GB = 50


def _ok(data: Any) -> dict[str, Any]:
    return {"ok": True, "data": data, "error": None}


def _err(message: str, *, code: str | None = None, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"ok": False, "data": extra or None, "error": message}
    if code:
        payload["error_code"] = code
    return payload


def _is_out_of_capacity(exc: Exception) -> bool:
    text = str(exc).lower()
    return "out of host capacity" in text or "out of capacity" in text


class OciKidepikClient:
    def __init__(self, settings: OciSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.config = oci_sdk_config(self.settings)
        self.identity = oci.identity.IdentityClient(self.config)
        self.compute = oci.core.ComputeClient(self.config)
        self.network = oci.core.VirtualNetworkClient(self.config)
        self.compartment_id = self.settings.compartment_ocid

    def status(self) -> dict[str, Any]:
        try:
            user = self.identity.get_user(self.settings.user_ocid).data
            ads = self.identity.list_availability_domains(self.compartment_id).data
            return _ok(
                {
                    "region": self.settings.region,
                    "tenancy_ocid": self.settings.tenancy_ocid,
                    "user_name": user.name,
                    "user_ocid": user.id,
                    "compartment_ocid": self.compartment_id,
                    "availability_domains": [ad.name for ad in ads[:20]],
                    "config_file": str(self.settings.config_file),
                }
            )
        except Exception as exc:
            return _err(f"Autenticación OCI fallida: {exc}", code="AUTH_FAILED")

    def list_instances(self, name_prefix: str = "kidepik") -> dict[str, Any]:
        try:
            instances = self.compute.list_instances(compartment_id=self.compartment_id).data
            filtered = [
                {
                    "id": inst.id,
                    "display_name": inst.display_name,
                    "lifecycle_state": inst.lifecycle_state,
                    "shape": inst.shape,
                    "availability_domain": inst.availability_domain,
                }
                for inst in instances
                if inst.display_name and inst.display_name.startswith(name_prefix)
            ]
            return _ok({"instances": filtered[:20], "count": len(filtered)})
        except Exception as exc:
            return _err(str(exc), code="LIST_INSTANCES_FAILED")

    def _find_vcn(self) -> Any | None:
        vcns = self.network.list_vcns(compartment_id=self.compartment_id).data
        for vcn in vcns:
            if vcn.display_name == VCN_NAME:
                return vcn
        return None

    def _find_subnet(self, vcn_id: str) -> Any | None:
        subnets = self.network.list_subnets(compartment_id=self.compartment_id, vcn_id=vcn_id).data
        for subnet in subnets:
            if subnet.display_name == SUBNET_NAME:
                return subnet
        return None

    def _ensure_security_list_rules(self, security_list_id: str) -> None:
        sl = self.network.get_security_list(security_list_id).data
        ingress = list(sl.ingress_security_rules or [])
        wanted = {(22, "0.0.0.0/0"), (80, "0.0.0.0/0"), (443, "0.0.0.0/0")}
        present = {
            (rule.tcp_options.destination_port_range.max, rule.source)
            for rule in ingress
            if rule.protocol == "6"
            and rule.tcp_options
            and rule.tcp_options.destination_port_range
        }
        for port, source in wanted:
            if (port, source) in present:
                continue
            ingress.append(
                oci.core.models.IngressSecurityRule(
                    protocol="6",
                    source=source,
                    is_stateless=False,
                    tcp_options=oci.core.models.TcpOptions(
                        destination_port_range=oci.core.models.PortRange(min=port, max=port)
                    ),
                )
            )
        egress = list(sl.egress_security_rules or [])
        if not any(rule.destination == "0.0.0.0/0" for rule in egress):
            egress.append(
                oci.core.models.EgressSecurityRule(
                    protocol="all",
                    destination="0.0.0.0/0",
                    is_stateless=False,
                )
            )
        self.network.update_security_list(
            security_list_id,
            oci.core.models.UpdateSecurityListDetails(
                ingress_security_rules=ingress,
                egress_security_rules=egress,
            ),
        )

    def network_ensure(self) -> dict[str, Any]:
        try:
            created: list[str] = []
            vcn = self._find_vcn()
            if vcn is None:
                vcn = self.network.create_vcn(
                    oci.core.models.CreateVcnDetails(
                        cidr_block=VCN_CIDR,
                        compartment_id=self.compartment_id,
                        display_name=VCN_NAME,
                        dns_label="kidepik",
                        freeform_tags={"project": "kidepik", "env": "validation"},
                    )
                ).data
                created.append("vcn")

            igws = self.network.list_internet_gateways(
                compartment_id=self.compartment_id, vcn_id=vcn.id
            ).data
            igw = next((g for g in igws if g.display_name == IGW_NAME), None)
            if igw is None:
                igw = self.network.create_internet_gateway(
                    oci.core.models.CreateInternetGatewayDetails(
                        compartment_id=self.compartment_id,
                        vcn_id=vcn.id,
                        display_name=IGW_NAME,
                        is_enabled=True,
                    )
                ).data
                created.append("internet_gateway")

            route_tables = self.network.list_route_tables(
                compartment_id=self.compartment_id, vcn_id=vcn.id
            ).data
            route_table = route_tables[0] if route_tables else None
            if route_table is None:
                return _err("VCN sin route table por defecto", code="NETWORK_FAILED")

            routes = list(route_table.route_rules or [])
            if not any(r.network_entity_id == igw.id for r in routes):
                routes.append(
                    oci.core.models.RouteRule(
                        destination="0.0.0.0/0",
                        destination_type="CIDR_BLOCK",
                        network_entity_id=igw.id,
                    )
                )
                self.network.update_route_table(
                    route_table.id,
                    oci.core.models.UpdateRouteTableDetails(route_rules=routes),
                )
                created.append("route_rule")

            subnet = self._find_subnet(vcn.id)
            if subnet is None:
                subnet = self.network.create_subnet(
                    oci.core.models.CreateSubnetDetails(
                        compartment_id=self.compartment_id,
                        vcn_id=vcn.id,
                        cidr_block=SUBNET_CIDR,
                        display_name=SUBNET_NAME,
                        dns_label="kidepikpub",
                        prohibit_public_ip_on_vnic=False,
                        route_table_id=route_table.id,
                        security_list_ids=[vcn.default_security_list_id],
                    )
                ).data
                created.append("subnet")

            self._ensure_security_list_rules(vcn.default_security_list_id)

            return _ok(
                {
                    "vcn_id": vcn.id,
                    "subnet_id": subnet.id,
                    "internet_gateway_id": igw.id,
                    "security_list_id": vcn.default_security_list_id,
                    "created": created,
                }
            )
        except Exception as exc:
            return _err(str(exc), code="NETWORK_FAILED")

    def _find_arm_ubuntu_image(self) -> str:
        images = self.compute.list_images(
            compartment_id=self.compartment_id,
            operating_system="Canonical Ubuntu",
            operating_system_version="24.04",
            shape=ARM_SHAPE,
            sort_by="TIMECREATED",
            sort_order="DESC",
        ).data
        for image in images:
            if image.lifecycle_state == "AVAILABLE":
                return image.id
        raise RuntimeError(
            "No se encontró imagen Ubuntu 24.04 para VM.Standard.A1.Flex en este compartment"
        )

    def _get_running_instance(self, display_name: str) -> Any | None:
        instances = self.compute.list_instances(compartment_id=self.compartment_id).data
        for inst in instances:
            if inst.display_name == display_name and inst.lifecycle_state in {
                "RUNNING",
                "PROVISIONING",
                "STARTING",
            }:
                return inst
        return None

    def instance_get(self, display_name: str = INSTANCE_NAME, instance_id: str = "") -> dict[str, Any]:
        try:
            inst = None
            if instance_id:
                inst = self.compute.get_instance(instance_id).data
            else:
                instances = self.compute.list_instances(compartment_id=self.compartment_id).data
                inst = next((i for i in instances if i.display_name == display_name), None)
            if inst is None:
                return _err(f"Instancia no encontrada: {display_name or instance_id}", code="NOT_FOUND")

            public_ip = None
            vnics = self.compute.list_vnic_attachments(
                compartment_id=self.compartment_id, instance_id=inst.id
            ).data
            for attachment in vnics:
                vnic = self.network.get_vnic(attachment.vnic_id).data
                if vnic.public_ip:
                    public_ip = vnic.public_ip
                    break

            return _ok(
                {
                    "id": inst.id,
                    "display_name": inst.display_name,
                    "lifecycle_state": inst.lifecycle_state,
                    "shape": inst.shape,
                    "availability_domain": inst.availability_domain,
                    "public_ip": public_ip,
                }
            )
        except Exception as exc:
            return _err(str(exc), code="INSTANCE_GET_FAILED")

    def launch_arm_instance(
        self,
        display_name: str = INSTANCE_NAME,
        ocpus: float = 1.0,
        memory_gb: float = 6.0,
        availability_domain: str = "",
    ) -> dict[str, Any]:
        existing = self._get_running_instance(display_name)
        if existing is not None:
            return self.instance_get(instance_id=existing.id)

        if not self.settings.ssh_public_key_file.is_file():
            return _err(
                f"Falta clave SSH pública: {self.settings.ssh_public_key_file}",
                code="SSH_KEY_MISSING",
            )

        network = self.network_ensure()
        if not network["ok"]:
            return network

        subnet_id = network["data"]["subnet_id"]
        ssh_key = self.settings.ssh_public_key_file.read_text(encoding="utf-8").strip()

        try:
            image_id = self._find_arm_ubuntu_image()
            ads = self.identity.list_availability_domains(self.compartment_id).data
            ad_names = [availability_domain] if availability_domain else [ad.name for ad in ads]
            last_error: Exception | None = None

            for ad_name in ad_names:
                try:
                    instance = self.compute.launch_instance(
                        oci.core.models.LaunchInstanceDetails(
                            availability_domain=ad_name,
                            compartment_id=self.compartment_id,
                            display_name=display_name,
                            shape=ARM_SHAPE,
                            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                                ocpus=ocpus,
                                memory_in_gbs=memory_gb,
                            ),
                            source_details=oci.core.models.InstanceSourceViaImageDetails(
                                image_id=image_id,
                                boot_volume_size_in_gbs=BOOT_VOLUME_GB,
                            ),
                            create_vnic_details=oci.core.models.CreateVnicDetails(
                                subnet_id=subnet_id,
                                assign_public_ip=True,
                                display_name=f"{display_name}-vnic",
                            ),
                            metadata={"ssh_authorized_keys": ssh_key},
                            freeform_tags={"project": "kidepik", "env": "validation"},
                        )
                    ).data
                    return _ok(
                        {
                            "id": instance.id,
                            "display_name": instance.display_name,
                            "lifecycle_state": instance.lifecycle_state,
                            "availability_domain": ad_name,
                            "image_id": image_id,
                        }
                    )
                except ServiceError as exc:
                    last_error = exc
                    if _is_out_of_capacity(exc):
                        continue
                    return _err(str(exc), code="LAUNCH_FAILED", ad=ad_name)
                except Exception as exc:
                    last_error = exc
                    if _is_out_of_capacity(exc):
                        continue
                    return _err(str(exc), code="LAUNCH_FAILED", ad=ad_name)

            return _err(
                str(last_error or "Sin capacidad ARM en ningún AD"),
                code="OUT_OF_CAPACITY",
                ads_tried=ad_names,
            )
        except Exception as exc:
            if _is_out_of_capacity(exc):
                return _err(str(exc), code="OUT_OF_CAPACITY")
            return _err(str(exc), code="LAUNCH_FAILED")

    def retry_launch_arm(
        self,
        max_attempts: int = 5,
        interval_seconds: int = 60,
        display_name: str = INSTANCE_NAME,
    ) -> dict[str, Any]:
        attempts: list[dict[str, Any]] = []
        for attempt in range(1, max_attempts + 1):
            result = self.launch_arm_instance(display_name=display_name)
            attempts.append({"attempt": attempt, "ok": result["ok"], "error": result.get("error")})
            if result["ok"]:
                result["data"]["attempts"] = attempts
                return result
            if result.get("error_code") != "OUT_OF_CAPACITY":
                result["data"] = {"attempts": attempts}
                return result
            if attempt < max_attempts:
                time.sleep(interval_seconds)
        return _err(
            f"Sin capacidad ARM tras {max_attempts} intentos",
            code="OUT_OF_CAPACITY",
            attempts=attempts,
        )
