// src/utils/safeDataAccess.ts
export const safeGet = (obj: any, path: string, defaultValue: any = null) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
};

export const safeMapLogs = (logs: any[]) => {
  return logs.map((log: any) => ({
    action: safeGet(log, 'action', 'Unknown'),
    target: safeGet(log, 'target', 'Unknown'),
    timestamp: safeGet(log, 'timestamp', new Date()),
    userName: safeGet(log, 'userName', safeGet(log, 'user.name', 'Unknown')),
    userId: safeGet(log, 'userId', safeGet(log, 'user._id', 'Unknown'))
  }));
};

export const safeMapPatients = (patients: any[]) => {
  return patients.map((patient: any) => ({
    _id: safeGet(patient, '_id'),
    name: safeGet(patient, 'name', safeGet(patient, 'patientName', 'Unknown')),
    phone: safeGet(patient, 'phone', safeGet(patient, 'phoneNumber', '')),
    status: safeGet(patient, 'status', safeGet(patient, 'patientStatus', 'pending')),
    visitConfirmed: safeGet(patient, 'visitConfirmed', false),
    treatmentAmount: safeGet(patient, 'treatmentAmount', 0),
    callbacks: safeGet(patient, 'callbacks', []),
    createdAt: safeGet(patient, 'createdAt', new Date()),
    updatedAt: safeGet(patient, 'updatedAt', new Date())
  }));
};

// 사용법:
// 기존: logs.map((log: any) => ({ action: log.action, ... }))
// 수정: safeMapLogs(logs)