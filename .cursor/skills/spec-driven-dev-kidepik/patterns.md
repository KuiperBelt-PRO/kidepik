# Patrones Python para SDD + TDD

Referencia auxiliar con patrones concretos para pytest, estructura de archivos, fixtures, mocks y specs como tipo. El agente carga este archivo solo cuando necesita profundizar durante la implementación.

---

## Estructura de archivos

Seguir la convención del proyecto. Si no existe, usar esta estructura por defecto:

```
src/
  modulo/
    __init__.py
    core.py           # lógica de negocio
    models.py         # dataclasses / pydantic models (spec como tipo)
    exceptions.py     # excepciones del dominio
tests/
  test_modulo/
    __init__.py
    conftest.py       # fixtures compartidas del módulo
    test_core.py      # tests de lógica
    test_models.py    # tests de validación de modelos
```

Si el proyecto usa `tests/` plano (sin subdirectorios), mantener esa convención.

---

## Spec como tipo (type hints + pydantic)

Los type hints y modelos pydantic actúan como spec ejecutable. Definirlos antes de implementar la lógica.

```python
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class DiscountRequest:
    price: Decimal
    percentage: Decimal  # 0-100

    def __post_init__(self):
        if not (0 <= self.percentage <= 100):
            raise ValueError(f"percentage must be 0-100, got {self.percentage}")
        if self.price < 0:
            raise ValueError(f"price must be >= 0, got {self.price}")


@dataclass(frozen=True)
class DiscountResult:
    original_price: Decimal
    discount_amount: Decimal
    final_price: Decimal
```

Con pydantic (si el proyecto lo usa):

```python
from pydantic import BaseModel, Field


class DiscountRequest(BaseModel):
    price: float = Field(ge=0)
    percentage: float = Field(ge=0, le=100)
```

Los modelos son la spec: definen entrada válida, salida esperada y restricciones.

---

## Nombrado de tests

```
test_<unidad>_<escenario>_<resultado>
```

Ejemplos:

```python
def test_calcular_descuento_porcentaje_cero_retorna_precio_original(): ...
def test_calcular_descuento_precio_negativo_lanza_value_error(): ...
def test_calcular_descuento_porcentaje_100_retorna_cero(): ...
```

Para clases de test (agrupar por unidad):

```python
class TestCalcularDescuento:
    def test_porcentaje_basico(self): ...
    def test_porcentaje_cero(self): ...
    def test_precio_negativo_lanza_error(self): ...
```

---

## Fixtures

Usar fixtures para datos de test reutilizables. Definir en `conftest.py` si las comparten varios módulos de test.

```python
import pytest

@pytest.fixture
def sample_discount_request():
    return DiscountRequest(price=Decimal("100"), percentage=Decimal("10"))

@pytest.fixture
def db_session(tmp_path):
    """Sesión de BD efímera para tests."""
    db = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(db)
    session = Session(db)
    yield session
    session.close()
```

Scope de fixtures:
- `function` (default): por test — para estado aislado.
- `module`: por módulo de test — para setup costoso compartido.
- `session`: global — solo para recursos muy caros (BD, servicios externos).

Preferir `function` por defecto para evitar contaminación entre tests.

---

## Parametrize para edge cases

Cuando la spec define múltiples combinaciones entrada/salida, usar `parametrize` en lugar de tests repetitivos:

```python
@pytest.mark.parametrize("price,percentage,expected", [
    (100, 0, 100),
    (100, 50, 50),
    (100, 100, 0),
    (0, 50, 0),
    (200.50, 10, 180.45),
])
def test_calcular_descuento_casos_validos(price, percentage, expected):
    assert calcular_descuento(price, percentage) == expected
```

Para tests de error:

```python
@pytest.mark.parametrize("price,percentage,error_msg", [
    (-1, 10, "price must be >= 0"),
    (100, -1, "percentage must be 0-100"),
    (100, 101, "percentage must be 0-100"),
])
def test_calcular_descuento_entrada_invalida(price, percentage, error_msg):
    with pytest.raises(ValueError, match=error_msg):
        calcular_descuento(price, percentage)
```

---

## Mocks y dependencias externas

Mockear solo lo que está fuera de tu control (BD, APIs, filesystem, reloj). No mockear lógica interna del módulo bajo test.

```python
from unittest.mock import patch, MagicMock


def test_servicio_obtiene_precio_de_api(sample_product):
    mock_response = MagicMock()
    mock_response.json.return_value = {"price": 42.0}
    mock_response.status_code = 200

    with patch("modulo.core.requests.get", return_value=mock_response) as mock_get:
        result = obtener_precio(sample_product.id)

    mock_get.assert_called_once_with(f"https://api.example.com/products/{sample_product.id}")
    assert result == 42.0
```

Para dependencias internas inyectables, preferir inyección de dependencias sobre mock:

```python
def calcular_total(items: list[Item], tax_calculator: TaxCalculator) -> Decimal:
    ...

def test_calcular_total_con_impuesto():
    fake_tax = FakeTaxCalculator(rate=Decimal("0.21"))
    result = calcular_total(items=[Item(price=100)], tax_calculator=fake_tax)
    assert result == Decimal("121")
```

---

## Async

Para código async, usar `pytest-asyncio`:

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user_returns_data(mock_db_session):
    user = await fetch_user(session=mock_db_session, user_id=1)
    assert user.name == "test"
```

Fixture async:

```python
@pytest.fixture
async def async_client(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
```

---

## Spec como docstring del módulo

Para features grandes, usar el docstring del módulo como spec viviente:

```python
"""
Módulo de cálculo de descuentos.

Spec:
- Acepta precio (>= 0) y porcentaje (0-100).
- Retorna precio final tras aplicar descuento.
- Lanza ValueError si los parámetros están fuera de rango.
- Los cálculos usan Decimal para evitar errores de punto flotante.
- Thread-safe: sin estado mutable compartido.
"""
```

La docstring se convierte en la referencia que los tests deben cubrir.

---

## Checklist de cruce spec-tests

Al finalizar la implementación, verificar explícitamente:

| Requisito de la spec | Test que lo cubre |
|---|---|
| Precio >= 0 | `test_precio_negativo_lanza_error` |
| Porcentaje 0-100 | `test_porcentaje_fuera_rango_lanza_error` |
| Resultado correcto | `test_casos_validos` (parametrize) |
| Thread-safe | N/A (sin estado, verificado por diseño) |

Si un requisito no tiene test y no es verificable por diseño, documentar por qué.
