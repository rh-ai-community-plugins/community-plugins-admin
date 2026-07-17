export const maintenanceLabelColor = (maintenance: string): 'orange' | 'teal' =>
  maintenance === 'red-hat' ? 'orange' : 'teal';

export const maintenanceDisplayText = (maintenance: string): string =>
  maintenance === 'red-hat' ? 'Red Hat' : 'Community';

export const statusLabelColor = (status: string): 'blue' | 'green' =>
  status === 'stable' ? 'green' : 'blue';
