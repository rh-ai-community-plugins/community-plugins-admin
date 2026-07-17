export const maintenanceLabelColor = (maintenance: string): 'orange' | 'teal' =>
  maintenance === 'red-hat' ? 'orange' : 'teal';

export const maintenanceDisplayText = (maintenance: string): string =>
  maintenance === 'red-hat' ? 'Red Hat' : 'Community';

export const statusLabelColor = (status: string): 'blue' | 'green' =>
  status === 'stable' ? 'green' : 'blue';

export const deploymentModelLabel = (model: string): string => {
  switch (model) {
    case 'cluster-shared':
      return 'Cluster-shared';
    case 'per-project':
      return 'Per-project';
    case 'both':
      return 'Cluster-shared / Per-project';
    default:
      return model;
  }
};
