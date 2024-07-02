import * as fs from 'fs';
import milestones from './milestones.json' assert { type: "json" };
import deliverables from './deliverables.json' assert { type: "json" };
import keyResults from './keyResults.json' assert { type: "json" };
import contributors from './contributors.json' assert { type: 'json'}


// Helper function to nest deliverables under milestones
const nestDeliverables = (milestones: any[], deliverables: any[]) => {
  milestones.forEach(milestone => {
    // parsing target date
    const originalDate = new Date(milestone.targetDate);
    originalDate.setHours(originalDate.getHours() + 1);
    const newDate = originalDate.toISOString();
    milestone.targetDate = newDate;
    
    milestone.deliverables = deliverables.filter(deliverable => deliverable.parentIdRef === milestone.id);
  });

  // Create contributors and coordinators objects
  milestones.forEach(milestone => {
    milestone.contributors = milestone.contributors.split(',').map((eachMContributor: string) => {
      const contributorObj = contributors.find(contributor => contributor.code === eachMContributor.trim());
      return {
        id: contributorObj?.id || 'N/A',
        ref: contributorObj?.ref || 'N/A',
        name: contributorObj?.name || 'N/A',
        code: contributorObj?.code || 'N/A',
        imageUrl: contributorObj?.imageUrl || 'N/A',
      }
    });

    milestone.coordinators = milestone.coordinators.split(',').map((coordinator: string) => {
      const coordinatorObj = contributors.find(contributor => contributor.code === coordinator.trim());
      return {
        id: coordinatorObj?.id || 'N/A',
        ref: coordinatorObj?.ref || 'N/A',
        name: coordinatorObj?.name || 'N/A',
        code: coordinatorObj?.code || 'N/A',
        imageUrl: coordinatorObj?.imageUrl || 'N/A',
      }
    })
  })

  // Adding budgetAnchor, workProgress and owner objects to deliverables
  milestones.forEach(milestone => {
    milestone.deliverables.forEach((deliverable: any) => {
      // adding budgetAnchor object
      deliverable.budgetAnchor = {
        project: {
          code: deliverable.projectCode,
          title: deliverable.projectTitle
        },
        workUnitBudget: deliverable['budgetAnchor.workUnitBudget'],
        deliverableBudget: deliverable['budgetAnchor.deliverableBudget'],
      }
      // adding workProgress object 
      deliverable.workProgress = {
        value: deliverable.workProgress == 0 ? 0.001 : deliverable.workProgress,
      }
      // adding owner object
      const owner = contributors.find(contributor => contributor.code === deliverable.owner);
      deliverable.owner = {
        id: owner?.id || 'N/A',
        ref: owner?.ref || 'N/A',
        name: owner?.name || 'N/A',
        code: owner?.code || 'N/A',
        imageUrl: owner?.imageUrl || 'N/A',
      };
      delete deliverable.projectCode
      delete deliverable.projectTitle
      delete deliverable['budgetAnchor.workUnitBudget']
      delete deliverable['budgetAnchor.deliverableBudget']
    })
  });

  milestones.forEach(milestone => {
    milestone.scope = {
      deliverables: milestone.deliverables,
      status: milestone['scope.status'],
      progress: {
        value: milestone['scope.progress.value'] == 0 ? 0.001 : milestone['scope.progress.value'],
      },
      totalDeliverables: milestone.deliverables.length,
      deliverablesCompleted: milestone.deliverables.filter((deliverable: any) => deliverable.status === 'DELIVERED').length,
    }
    delete milestone['scope.status']
    delete milestone['scope.progress.value']
    delete milestone.deliverables
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
