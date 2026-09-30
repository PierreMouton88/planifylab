import { planifyLab } from "./planifylab.ts";

const result = planifyLab({
  samples: [
{
      "id": "S001",
      "type": "BLOOD", 
      "priority": "URGENT",
      "analysisTime": 30,
      "arrivalTime": "09:00",
      "patientId": "P001"
    },

  ],
  technicians: [
    {
      "id": "T001", 
      "name": "Alice Martin",
      "speciality": "BLOOD",
      "startTime": "08:00",
      "endTime": "17:00"
    }  
  ],
  equipment: [
     {
      "id": "E001",
      "name": "Analyseur Sang A",
      "type": "BLOOD", 
      "available": true
    }
  ],
});

console.log(result.schedule);
console.log(result.metrics);