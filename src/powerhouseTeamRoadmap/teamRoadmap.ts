import * as fs from 'fs';
import milestones from './milestones.json' assert { type: "json" };
import deliverables from './deliverables.json' assert { type: "json" };
import keyResults from './keyResults.json' assert { type: "json" };


// Helper function to nest deliverables under milestones
const nestDeliverables = (milestones: any[], deliverables: any[]) => {
  milestones.forEach(milestone => {
    milestone.deliverables = deliverables.filter(deliverable => deliverable.parentIdRef === milestone.id);
  });
};

// Helper function to nest key results under deliverables
const nestKeyResults = (deliverables: any[], keyResults: any[]) => {
  deliverables.forEach(deliverable => {
    deliverable.keyResults = keyResults.filter(keyResult => keyResult.parentIdRef === deliverable.id);
  });
};

// Nest deliverables under milestones
nestDeliverables(milestones, deliverables);

// Nest key results under deliverables
nestKeyResults(deliverables, keyResults);

// Write the hierarchical structure to a new JSON file
fs.writeFile(`src/powerhouseTeamRoadmap/hierarchical_data.json`, JSON.stringify(milestones), (err) => {
    if (err) throw err;
    console.log('Hierarchical data has been created successfully.');
});
