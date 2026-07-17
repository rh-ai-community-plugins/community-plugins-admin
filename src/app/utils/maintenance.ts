/**
 * Returns the PatternFly label color for a maintenance type.
 * 'red-hat' → 'orange'; anything else (e.g. 'community') → 'teal'.
 */
export const maintenanceLabelColor = (maintenance: string): 'orange' | 'teal' =>
  maintenance === 'red-hat' ? 'orange' : 'teal';

/**
 * Returns the human-readable display text for a maintenance type.
 * 'red-hat' → 'Red Hat'; anything else → 'Community'.
 */
export const maintenanceDisplayText = (maintenance: string): string =>
  maintenance === 'red-hat' ? 'Red Hat' : 'Community';
