import type { Sample, Technician, Equipment } from "./types.ts";


//Sépare les heures en string en number puis les repasse de number a string 
export function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time
    .split(":")
    .map((value) => Number(value) || 0);
  return hours * 60 + minutes;
}

export function toHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

//Coompatibilité
//Technicien ↔ Échantillon
// Technicien BLOOD → Échantillon BLOOD ✅
// Technicien GENERAL → N'importe quel échantillon ✅
// Technicien URINE → Échantillon BLOOD ❌
// Équipement ↔ Échantillon
// Équipement BLOOD → Échantillon BLOOD ✅
// Équipement URINE → Échantillon BLOOD ❌

export function canTechnicianHandle(tech: Technician, sample: Sample): boolean {
  return tech.speciality === sample.type || tech.speciality === "GENERAL";
}

export function canEquipmentHandle(equip: Equipment, sample: Sample): boolean {
  return equip.type === sample.type && equip.available;
}
