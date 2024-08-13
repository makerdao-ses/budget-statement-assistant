import * as fs from 'fs';
import projects from './projects.json' assert { type: "json" };
import deliverables from './deliverables.json' assert { type: "json" };
import keyResults from './keyResults.json' assert { type: "json" };
import supportedProjects from './supportedProjects.json' assert { type: 'json' }
import supportedKeyResults from './supportedKeyResults.json' assert { type: 'json' }
import supportedDeliverables from './supportedDeliverables.json' assert { type: 'json' }


const nestedProjects = (projects: any[], deliverables: any[], keyResults: any[]) => {
    projects.forEach(project => {
        project.owner = {
            id: '',
            ref: '',
            name: '',
            code: project.owner,
            imageUrl: ''
        }
        project.progress = {
            value: project.progress == 0 ? 0.001 : project.progress,
        }
        project.deliverables = deliverables.reduce((acc: any[], deliverable: any) => {
            if (deliverable.parentIdRef === project.id) {
                acc.push({
                    ...deliverable,
                    owner: {
                        id: '',
                        ref: '',
                        name: '',
                        code: deliverable.owner,
                        imageUrl: ''
                    },
                    progress: {
                        value: deliverable.progress == 0 ? 0.001 : deliverable.progress,
                    }
                });
            }
            return acc;
        }, []);
    });

    projects.forEach(project => {
        project.deliverables.forEach((deliverable: any) => {
            deliverable.keyResults = keyResults.filter(keyResult => keyResult.parentIdRef === deliverable.id);
        });
    });
}


const nestedSupportedProjects = (supportedProjects: any[], supportedDeliverables: any[], supportedKeyResults: any[]) => {
    supportedProjects.forEach(project => {
        project.projectOwner = {
            id: '',
            ref: '',
            name: project.projectOwner,
            code: '',
            imageUrl: ''
        }
        project.progress = {
            value: project.progress == 0 ? 0.001 : project.progress,
        }
        project.supportedDeliverables = supportedDeliverables.reduce((acc: any[], deliverable: any) => {
            if (deliverable.parentIdRef === project.id) {
                acc.push({
                    ...deliverable,
                    owner: {
                        id: '',
                        ref: '',
                        name: '',
                        code: deliverable.owner,
                        imageUrl: ''
                    },
                    progress: {
                        value: deliverable.progress == 0 ? 0.001 : deliverable.progress,
                    }
                });
            }
            return acc;
        }, []);
    });

    supportedProjects.forEach(project => {
        project.supportedDeliverables.forEach((deliverable: any) => {
            deliverable.supportedKeyResults = supportedKeyResults.filter(keyResult => keyResult.parentIdRef === deliverable.id);
        });
    });
}



// Nest deliverables under projects

nestedProjects(projects, deliverables, keyResults);

nestedSupportedProjects(supportedProjects, supportedDeliverables, supportedKeyResults);

// Write the hierarchical structure to a new JSON file
fs.writeFile(`src/powerhouseTeamProjects/hierarchical_projects.json`, JSON.stringify(projects), (err) => {
    if (err) throw err;
    console.log('Hierarchical data has been created successfully.');
});

fs.writeFile(`src/powerhouseTeamProjects/hierarchical_supportedProjects.json`, JSON.stringify(supportedProjects), (err) => {
    if (err) throw err;
    console.log('Hierarchical data has been created successfully.');
});