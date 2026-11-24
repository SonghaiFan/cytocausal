import cytoscape from "cytoscape";

const extensions = {
  cola: () => import("cytoscape-cola"),
  dagre: () => import("cytoscape-dagre"),
  elk: () => import("cytoscape-elk"),
  fcose: () => import("cytoscape-fcose"),
  "cose-bilkent": () => import("cytoscape-cose-bilkent"),
  cise: () => import("cytoscape-cise"),
};
const registrations = new Map<string, Promise<void>>();

/** Download each optional layout only when the learner selects it. */
export async function registerLayout(name: string) {
  if (!(name in extensions)) return;
  let registration = registrations.get(name);
  if (!registration) {
    registration = extensions[name as keyof typeof extensions]().then(module => {
      cytoscape.use(module.default);
    }).catch(error => {
      registrations.delete(name);
      throw error;
    });
    registrations.set(name, registration);
  }
  await registration;
}
