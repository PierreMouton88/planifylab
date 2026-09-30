import type {
  Sample,
  Technician,
  Equipment,
  PlanningEntry,
  SamplePriority,
  LabInput,
  LabOutput,
  Metrics,
} from "./types.ts";
import {
  toMinutes,
  toHHMM,
  canTechnicianHandle,
  canEquipmentHandle,
} from "./utils.ts";

const PRIORITY_RANK: Record<SamplePriority, number> = {
  STAT: 0,
  URGENT: 1,
  ROUTINE: 2,
};

//On veut trier par priorité d'abord, puis par heure d'arrivée ensuite logiquement
export function sortSamples(samples: Sample[]): Sample[] {
  return [...samples].sort((a, b) => {
    //A priorité équivalente, on compare les heures d'arrivée pour trier correctement
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    //On compare les heures d'arrivée en minutes pour trier correctement
    return toMinutes(a.arrivalTime) - toMinutes(b.arrivalTime);
  });
}

export function buildSchedule(
  samples: Sample[],
  technicians: Technician[],
  equipment: Equipment[],
): PlanningEntry[] {
  //On veut l'heure de dispo de chaque techos
  const techDispo = new Map<string, number>();
  for (const tech of technicians) {
    techDispo.set(tech.id, toMinutes(tech.startTime));
  }
  //pareil heure dispo chaque equipement
  const equipDispo = new Map<string, number>();
  for (const equip of equipment) {
    equipDispo.set(equip.id, 0);
  }

  const planning: PlanningEntry[] = [];

  for (const sample of sortSamples(samples)) {
    const compatibleTechs = technicians.filter((t) =>
      canTechnicianHandle(t, sample),
    );
    const compatibleEquips = equipment.filter((e) =>
      canEquipmentHandle(e, sample),
    );

    let bestMatch: {
      tech: Technician;
      equip: Equipment;
      start: number;
      end: number;
    } | null = null;

    for (const tech of compatibleTechs) {
      for (const equip of compatibleEquips) {
        //On doit prendre l'heure de dispo la plus tardive sinon ca va créer un conflit
        const start = Math.max(
          toMinutes(sample.arrivalTime),
          techDispo.get(tech.id)!,
          equipDispo.get(equip.id)!,
        );

        const end = start + sample.analysisTime;

        if (end > toMinutes(tech.endTime)) continue; // Sinon le techos ne peut pas finir à temps

        //On vérif s'il est spécialiste pour l'échantillon et si le meilleur match actuel est un spécialiste aussi
        const isSpecialist = tech.speciality === sample.type;
        const isbestmatchSpecialist =
          bestMatch !== null && bestMatch.tech.speciality === sample.type;

        //trie si l'heure de début est plus tôt, et si start est egal, on priorise le spécialiste pour l'échantillon
        if (
          bestMatch === null ||
          start < bestMatch.start ||
          (start === bestMatch.start && isSpecialist && !isbestmatchSpecialist)
        ) {
          bestMatch = { tech, equip, start, end };
        }

        // Si aucune paire possible n signale et on passe au suivant
        if (bestMatch === null) {
          console.warn(`Impossible de planifier l'échantillon ${sample.id}`);
          continue;
        }
        // On bloque les deux ressources jusqu'à la fin de l'analyse
        techDispo.set(bestMatch.tech.id, bestMatch.end);
        equipDispo.set(bestMatch.equip.id, bestMatch.end);

        planning.push({
          sampleId: sample.id,
          technicianId: bestMatch.tech.id,
          equipmentId: bestMatch.equip.id,
          startTime: toHHMM(bestMatch.start),
          endTime: toHHMM(bestMatch.end),
          priority: sample.priority,
        });

        planning.sort(
          (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
        );
      }
    }
  }

  return planning;
}


function countConflicts(planning: PlanningEntry[]): number {
  let conflicts = 0;
  // On compare chaque ligne avec toutes celles qui suivent (j commence à i + 1 pour ne pas compter deux fois le même conflit)
  for (let i = 0; i < planning.length; i++) {
    for (let j = i + 1; j < planning.length; j++) {
      const a = planning[i];
      const b = planning[j];
    
      // Vérifie l'unicité des techos ou equipement par id
      const sameResource =
        a.technicianId === b.technicianId || a.equipmentId === b.equipmentId;

      //Vérifie si deux analyse overlapent 
      const overlap =
        toMinutes(a.startTime) < toMinutes(b.endTime) &&
        toMinutes(b.startTime) < toMinutes(a.endTime);
    //compteur de conflits
      if (sameResource && overlap) conflicts++;
    }
  }

  return conflicts;
}


function computeMetrics(planning: PlanningEntry[]): Metrics {
  //Attention si planning vide,  on divise par zéro
  if (planning.length === 0) {
    return { totalTime: 0, efficiency: 0, conflicts: 0 };
  }

  let firstStart = 100000000000000
  let lastEnd = 0;
  let totalAnalysisTime = 0;

  //boucle sur tout le tableau pour savor le temps total des analyses et le debut/fin 
  for (const p of planning) {
    const start = toMinutes(p.startTime);
    const end = toMinutes(p.endTime);

    firstStart = Math.min(firstStart, start);
    lastEnd = Math.max(lastEnd, end);
    totalAnalysisTime += end - start;
  }

  const totalTime = lastEnd - firstStart;
  const efficiency = Math.round((totalAnalysisTime / totalTime) * 100);

  return {
    totalTime,
    efficiency,
    conflicts: countConflicts(planning),
  };
}






export function planifyLab(data: LabInput): LabOutput {
  const schedule = buildSchedule(data.samples, data.technicians, data.equipment);
  const metrics = computeMetrics(schedule);
  return { schedule, metrics };
}
