
import { User, QCReport, CheckpointDefinition, Stage } from './types';
import { INITIAL_ADMIN_USER, FQC_CHECKPOINTS, PACKAGING_CHECKPOINTS } from './constants.tsx';

const USERS_KEY = 'flex_qc_users';
const REPORTS_KEY = 'flex_qc_reports';
const CUSTOM_CHECKPOINTS_KEY = 'flex_qc_custom_checkpoints';

export const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    const defaultUsers = [INITIAL_ADMIN_USER];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
  }
  return JSON.parse(stored);
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getStoredReports = (): QCReport[] => {
  const stored = localStorage.getItem(REPORTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveReport = (report: QCReport) => {
  const reports = getStoredReports();
  reports.push(report);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  
  // Log to console for debugging "Google Sheets" simulation
  console.log('✅ Report Saved to "Database":', report);
};

export const getCustomCheckpoints = (): { FQC: CheckpointDefinition[], Packaging: CheckpointDefinition[] } => {
  const stored = localStorage.getItem(CUSTOM_CHECKPOINTS_KEY);
  return stored ? JSON.parse(stored) : { FQC: [], Packaging: [] };
};

export const addCustomCheckpoint = (stage: 'FQC' | 'Packaging', checkpoint: CheckpointDefinition) => {
  const current = getCustomCheckpoints();
  current[stage].push(checkpoint);
  localStorage.setItem(CUSTOM_CHECKPOINTS_KEY, JSON.stringify(current));
};

export const setCustomCheckpoints = (stage: 'FQC' | 'Packaging', checkpoints: CheckpointDefinition[]) => {
  const current = getCustomCheckpoints();
  current[stage] = checkpoints;
  localStorage.setItem(CUSTOM_CHECKPOINTS_KEY, JSON.stringify(current));
};

export const getAllCheckpoints = (stage: Stage): CheckpointDefinition[] => {
  if (!stage) return [];
  
  const customs = getCustomCheckpoints()[stage as 'FQC' | 'Packaging'] || [];
  
  // If user has uploaded custom rules, those take priority and replace defaults for a clean bulk-management experience
  if (customs.length > 0) {
    return customs;
  }

  const defaults = stage === 'FQC' ? FQC_CHECKPOINTS : PACKAGING_CHECKPOINTS;
  return defaults as CheckpointDefinition[];
};
