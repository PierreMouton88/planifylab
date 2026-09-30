// TODO: Ajouter des tests unitaires 
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Sample, Technician, Equipment, PlanningEntry } from "../src/types.ts";
import { canTechnicianHandle, canEquipmentHandle } from "../src/utils.ts";
import {
  sortSamples,
  buildSchedule,
  computeMetrics,
  countConflicts,
  planifyLab,
} from "../src/planifylab.ts";

// --- Petites fabriques : créent un objet valide, on ne précise que ce qui change ---
function sample(over: Partial<Sample> = {}): Sample {
  return { id: "S", type: "BLOOD", priority: "ROUTINE", analysisTime: 30, arrivalTime: "08:00", patientId: "P", ...over };
}
function tech(over: Partial<Technician> = {}): Technician {
  return { id: "T", name: "Tech", speciality: "BLOOD", startTime: "08:00", endTime: "17:00", ...over };
}
function equip(over: Partial<Equipment> = {}): Equipment {
  return { id: "E", name: "Machine", type: "BLOOD", available: true, ...over };
}
function entry(over: Partial<PlanningEntry> = {}): PlanningEntry {
  return { sampleId: "S", technicianId: "T", equipmentId: "E", startTime: "08:00", endTime: "08:30", priority: "ROUTINE", ...over };
}

describe("compatibilité", () => {
  test("un spécialiste traite son type", () => {
    assert.equal(canTechnicianHandle(tech({ speciality: "BLOOD" }), sample({ type: "BLOOD" })), true);
  });
  test("un GENERAL traite tout", () => {
    assert.equal(canTechnicianHandle(tech({ speciality: "GENERAL" }), sample({ type: "TISSUE" })), true);
  });
  test("un spécialiste refuse un autre type", () => {
    assert.equal(canTechnicianHandle(tech({ speciality: "URINE" }), sample({ type: "BLOOD" })), false);
  });
  test("un équipement du bon type et disponible est accepté", () => {
    assert.equal(canEquipmentHandle(equip({ type: "BLOOD" }), sample({ type: "BLOOD" })), true);
  });
  test("un équipement indisponible est refusé", () => {
    assert.equal(canEquipmentHandle(equip({ available: false }), sample()), false);
  });
  test("un équipement d'un autre type est refusé", () => {
    assert.equal(canEquipmentHandle(equip({ type: "URINE" }), sample({ type: "BLOOD" })), false);
  });
});

describe("sortSamples", () => {
  test("un STAT arrivé tard passe devant un ROUTINE arrivé tôt", () => {
    const result = sortSamples([
      sample({ id: "R", priority: "ROUTINE", arrivalTime: "08:00" }),
      sample({ id: "S", priority: "STAT", arrivalTime: "16:55" }),
    ]);
    assert.deepEqual(result.map((s) => s.id), ["S", "R"]);
  });
  test("ordre complet STAT > URGENT > ROUTINE", () => {
    const result = sortSamples([
      sample({ id: "R", priority: "ROUTINE" }),
      sample({ id: "U", priority: "URGENT" }),
      sample({ id: "S", priority: "STAT" }),
    ]);
    assert.deepEqual(result.map((s) => s.id), ["S", "U", "R"]);
  });
  test("à priorité égale, le premier arrivé passe devant", () => {
    const result = sortSamples([
      sample({ id: "tard", priority: "URGENT", arrivalTime: "10:00" }),
      sample({ id: "tot", priority: "URGENT", arrivalTime: "09:00" }),
    ]);
    assert.deepEqual(result.map((s) => s.id), ["tot", "tard"]);
  });
  test("ne modifie pas le tableau d'origine", () => {
    const input = [sample({ id: "R", priority: "ROUTINE" }), sample({ id: "S", priority: "STAT" })];
    sortSamples(input);
    assert.deepEqual(input.map((s) => s.id), ["R", "S"]);
  });
});

describe("buildSchedule", () => {
  test("exemple ultra-simple : 1 échantillon → 1 ligne", () => {
    const result = buildSchedule(
      [sample({ id: "S1", priority: "URGENT", arrivalTime: "09:00" })],
      [tech({ id: "T1" })],
      [equip({ id: "E1" })]
    );
    assert.deepEqual(result, [
      { sampleId: "S1", technicianId: "T1", equipmentId: "E1", startTime: "09:00", endTime: "09:30", priority: "URGENT" },
    ]);
  });

  test("ne commence pas avant le début de service du technicien", () => {
    const result = buildSchedule([sample({ arrivalTime: "07:00" })], [tech({ startTime: "08:00" })], [equip()]);
    assert.equal(result[0].startTime, "08:00");
  });

  test("ne commence pas avant l'arrivée de l'échantillon", () => {
    const result = buildSchedule([sample({ arrivalTime: "10:15" })], [tech()], [equip()]);
    assert.equal(result[0].startTime, "10:15");
  });

  test("avec une seule ressource, le STAT est traité en premier", () => {
    const result = buildSchedule(
      [
        sample({ id: "R", priority: "ROUTINE", arrivalTime: "08:00" }),
        sample({ id: "S", priority: "STAT", arrivalTime: "08:00" }),
      ],
      [tech()],
      [equip()]
    );
    assert.equal(result[0].sampleId, "S");
    assert.equal(result[1].startTime, result[0].endTime); // enchaîné juste après
  });

  test("avec deux ressources, deux analyses tournent en parallèle", () => {
    const result = buildSchedule(
      [sample({ id: "A" }), sample({ id: "B" })],
      [tech({ id: "T1" }), tech({ id: "T2" })],
      [equip({ id: "E1" }), equip({ id: "E2" })]
    );
    assert.equal(result[0].startTime, "08:00");
    assert.equal(result[1].startTime, "08:00");
    assert.notEqual(result[0].technicianId, result[1].technicianId);
    assert.notEqual(result[0].equipmentId, result[1].equipmentId);
  });

  test("préfère un spécialiste à un GENERAL à horaire égal", () => {
    const result = buildSchedule(
      [sample({ type: "BLOOD" })],
      [tech({ id: "GEN", speciality: "GENERAL" }), tech({ id: "SPE", speciality: "BLOOD" })],
      [equip()]
    );
    assert.equal(result[0].technicianId, "SPE");
  });

  test("utilise un GENERAL s'il n'y a pas de spécialiste", () => {
    const result = buildSchedule(
      [sample({ type: "URINE" })],
      [tech({ id: "B", speciality: "BLOOD" }), tech({ id: "GEN", speciality: "GENERAL" })],
      [equip({ type: "URINE" })]
    );
    assert.equal(result[0].technicianId, "GEN");
  });

  test("ignore un échantillon sans équipement disponible", () => {
    const result = buildSchedule([sample()], [tech()], [equip({ available: false })]);
    assert.equal(result.length, 0);
  });

  test("ignore une analyse qui dépasserait la fin de service", () => {
    const result = buildSchedule(
      [sample({ analysisTime: 90, arrivalTime: "08:00" })],
      [tech({ startTime: "08:00", endTime: "09:00" })],
      [equip()]
    );
    assert.equal(result.length, 0);
  });

  test("le planning est trié par heure de début", () => {
    const result = buildSchedule(
      [
        sample({ id: "R", priority: "ROUTINE", arrivalTime: "08:00" }),
        sample({ id: "S", priority: "STAT", arrivalTime: "11:00" }),
      ],
      [tech({ id: "T1" }), tech({ id: "T2" })],
      [equip({ id: "E1" }), equip({ id: "E2" })]
    );
    const starts = result.map((e) => e.startTime);
    assert.deepEqual(starts, [...starts].sort());
  });
});

describe("countConflicts", () => {
  test("détecte un chevauchement sur le même technicien", () => {
    const conflicts = countConflicts([
      entry({ technicianId: "T1", equipmentId: "E1", startTime: "09:00", endTime: "09:30" }),
      entry({ technicianId: "T1", equipmentId: "E2", startTime: "09:15", endTime: "09:45" }),
    ]);
    assert.equal(conflicts, 1);
  });
  test("pas de conflit si les créneaux s'enchaînent pile", () => {
    const conflicts = countConflicts([
      entry({ startTime: "09:00", endTime: "09:30" }),
      entry({ startTime: "09:30", endTime: "10:00" }),
    ]);
    assert.equal(conflicts, 0);
  });
  test("pas de conflit si les ressources sont différentes", () => {
    const conflicts = countConflicts([
      entry({ technicianId: "T1", equipmentId: "E1" }),
      entry({ technicianId: "T2", equipmentId: "E2" }),
    ]);
    assert.equal(conflicts, 0);
  });
});

describe("computeMetrics", () => {
  test("planning vide → tout à zéro", () => {
    assert.deepEqual(computeMetrics([]), { totalTime: 0, efficiency: 0, conflicts: 0 });
  });
  test("analyses enchaînées sans trou → 100 %", () => {
    const metrics = computeMetrics([
      entry({ startTime: "08:30", endTime: "08:50" }),
      entry({ startTime: "08:50", endTime: "09:35" }),
      entry({ startTime: "09:35", endTime: "10:05" }),
    ]);
    assert.equal(metrics.totalTime, 95);
    assert.equal(metrics.efficiency, 100);
  });
  test("un trou dans le planning fait baisser l'efficacité", () => {
    // 60 min d'analyse sur 90 min de planning → 67 %
    const metrics = computeMetrics([
      entry({ startTime: "08:00", endTime: "08:30" }),
      entry({ startTime: "09:00", endTime: "09:30" }),
    ]);
    assert.equal(metrics.totalTime, 90);
    assert.equal(metrics.efficiency, 67);
  });
});

describe("planifyLab (bout en bout)", () => {
  test("renvoie un planning et des métriques sans conflit", () => {
    const result = planifyLab({
      samples: [
        sample({ id: "S1", priority: "ROUTINE", arrivalTime: "08:00" }),
        sample({ id: "S2", priority: "URGENT", analysisTime: 45, arrivalTime: "08:10" }),
        sample({ id: "S3", priority: "STAT", analysisTime: 20, arrivalTime: "08:30" }),
      ],
      technicians: [tech({ id: "T1" })],
      equipment: [equip({ id: "E1" })],
    });
    assert.deepEqual(result.schedule.map((e) => e.sampleId), ["S3", "S2", "S1"]);
    assert.equal(result.metrics.conflicts, 0);
    assert.equal(result.metrics.totalTime, 95);
  });
});