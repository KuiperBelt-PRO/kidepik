import { ScrollView, StyleSheet, View } from "react-native";

import { ChallengeCard } from "../components/ChallengeCard";
import { ChoiceList } from "../components/ChoiceList";
import { DialogueBox } from "../components/DialogueBox";
import { MapNode } from "../components/MapNode";
import { MiniGameShell } from "../components/MiniGameShell";
import { RewardSlot } from "../components/RewardSlot";
import { SessionHud } from "../components/SessionHud";
import { ThemeBackground } from "../components/ThemeBackground";
import { tokens } from "../theme/tokens";
import type { MockupId } from "./catalog";

type Props = {
  mockupId: MockupId;
};

export function MockupScreen({ mockupId }: Props) {
  return (
    <ThemeBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        {mockupId === "dialogue" ? (
          <DialogueBox
            speaker="Guía del bosque"
            text="Las runas del sendero brillan cuando escuchas con atención. ¿Estás listo para el primer reto?"
          />
        ) : null}

        {mockupId === "choice" ? (
          <ChoiceList
            choices={[
              "Seguir el sendero luminoso",
              "Explorar la cueva antigua",
              "Preguntar al sabio del pueblo",
            ]}
          />
        ) : null}

        {mockupId === "challenge" ? (
          <ChallengeCard
            question="Si tienes 3 cristales y encuentras 2 más, ¿cuántos llevas en tu mochila?"
            answers={["4", "5", "6", "7"]}
            hint="Suma los cristales que ya tenías con los nuevos."
            showHint
          />
        ) : null}

        {mockupId === "map" ? (
          <View style={styles.mapRow}>
            <MapNode label="Bosque" subject="Mates" active />
            <MapNode label="Torre" subject="Lengua" unlocked />
            <MapNode label="Cueva" subject="Lógica" unlocked={false} />
          </View>
        ) : null}

        {mockupId === "hud" ? (
          <SessionHud
            subject="Matemáticas"
            zone="Bosque de los Números"
            progress={62}
          />
        ) : null}

        {mockupId === "reward" ? (
          <RewardSlot
            itemName="Cristal de memoria"
            description="Brilla cuando recuerdas una lección. +1 al hilo narrativo."
          />
        ) : null}

        {mockupId === "minigame" ? (
          <MiniGameShell title="Atrapa luciérnagas" />
        ) : null}
      </ScrollView>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: tokens.spacing.md,
    paddingTop: tokens.spacing.xxl,
    gap: tokens.spacing.md,
  },
  mapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.md,
    justifyContent: "center",
  },
});
