//INPUTS

export type Sample = {
  id: string;
  type: SampleType; // BLOOD, URINE, ou TISSUE
  priority: SamplePriority; // STAT, URGENT, ou ROUTINE
  analysisTime: number; // Durée en minutes
  arrivalTime: string; // Heure d'arrivée au labo
  patientId: string; // Pour traçabilité
};

export type SampleType = "BLOOD" | "URINE" | "TISSUE";
export type SamplePriority = "STAT" | "URGENT" | "ROUTINE";

export type Technician = {
  id: string;
  name: string;
    speciality: SampleType | "GENERAL"; // BLOOD, URINE, TISSUE, ou GENERAL
    startTime: string; // Début de service
    endTime: string; // Fin de service
};

export type Equipment = {
  id: string;
  name: string;
    type: SampleType; // BLOOD, URINE, ou TISSUE
    available: boolean; // Dispo au début ou pas
};

//OUTPUTS


export type PlanningEntry = {
  sampleId: string;
  technicianId: string;
    equipmentId: string;
    startTime: string;
    endTime: string;
    priority: SamplePriority;
}; 

export type Metrics = {
  totalTime: number;                // Durée totale du planning (minutes)
  efficiency: number;              // % = (somme durées analyses) / (temps total planning) * 100
  conflicts: number;               // Nombre de conflits détectés
};  

export type LabInput = { samples: Sample[]; technicians: Technician[]; equipment: Equipment[] };
export type LabOutput = { schedule: PlanningEntry[]; metrics: Metrics };

// 🔍 Détails Importantes
// Priorités (par ordre d'importance)
// STAT - Urgence vitale, résultat en < 1h
// URGENT - Important, résultat dans la journée
// ROUTINE - Standard, peut attendre


// Types d'Échantillons
// BLOOD - Analyses sanguines (hémogramme, biochimie)
// URINE - Analyses d'urine (ECBU, bandelette)
// TISSUE - Biopsies et anatomopathologie

// Spécialités Techniciens
// BLOOD - Spécialisé analyses sanguines
// URINE - Spécialisé analyses d'urine
// TISSUE - Spécialisé anatomopathologie
// GENERAL - Polyvalent (peut tout faire mais moins efficace)


//TODO: Mettre des vérifications pour s'assurer que les regles de compatibilités sont respectées lors de l'affectation des techniciens et équipements aux échantillons. 
// ⚡ Règles de Compatibilité
// Technicien ↔ Échantillon
// Technicien BLOOD → Échantillon BLOOD ✅
// Technicien GENERAL → N'importe quel échantillon ✅
// Technicien URINE → Échantillon BLOOD ❌
// Équipement ↔ Échantillon
// Équipement BLOOD → Échantillon BLOOD ✅
// Équipement URINE → Échantillon BLOOD ❌

// TODO: Ajouter vérif sur le format des horaires et durées pour s'assurer qu'ils sont valides 
// 🕒 Gestion du Temps
// Format Horaires
// Heures : Format "HH:MM" (ex: "09:30")
// Durées : En minutes (ex: 45 = 45 minutes)
