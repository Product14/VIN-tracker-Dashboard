import type { Rooftop } from './ragLogic';

export const DEFAULT_ROOFTOPS: Rooftop[] = [
  // Sales Inbound (5)
  {
    teamId: null, enterpriseName: 'Bridge Auto Group', rooftopName: 'Bridge Auto', agentType: 'Sales Inbound',
    totalLeads: 668, viniInteractions: 34, callLeads: 34, smsLeads: 0,
    appointments: 7, apptRate: 0.2059, avgScore: 77.22,
  },
  {
    teamId: null, enterpriseName: 'Edwards Chevrolet Downtown', rooftopName: 'Edwards Chevrolet Downtown', agentType: 'Sales Inbound',
    totalLeads: 250, viniInteractions: 150, callLeads: 150, smsLeads: 0,
    appointments: 10, apptRate: 0.0667, avgScore: 70.22,
  },
  {
    teamId: null, enterpriseName: 'Edwards Chevrolet Downtown', rooftopName: 'Edwards Honda', agentType: 'Sales Inbound',
    totalLeads: 301, viniInteractions: 199, callLeads: 199, smsLeads: 1,
    appointments: 13, apptRate: 0.0653, avgScore: 71.04,
  },
  {
    teamId: null, enterpriseName: 'Guam Autospot', rooftopName: 'Guam AutoSpot', agentType: 'Sales Inbound',
    totalLeads: 176, viniInteractions: 170, callLeads: 170, smsLeads: 0,
    appointments: 32, apptRate: 0.1882, avgScore: 70.75,
  },
  {
    teamId: null, enterpriseName: 'Paragon Motors of Woodside Inc dba Paragon Honda', rooftopName: 'Paragon Honda', agentType: 'Sales Inbound',
    totalLeads: 168, viniInteractions: 161, callLeads: 159, smsLeads: 0,
    appointments: 16, apptRate: 0.0994, avgScore: 73.83,
  },

  // Sales Outbound (4)
  {
    teamId: null, enterpriseName: 'Rick Case Auto Group', rooftopName: 'Rick Case Hyundai and Genesis Roswell', agentType: 'Sales Outbound',
    totalLeads: 762, viniInteractions: 9, callLeads: 9, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 78.8,
  },
  {
    teamId: null, enterpriseName: 'Rick Case Auto Group', rooftopName: 'Rick Case Mazda', agentType: 'Sales Outbound',
    totalLeads: 536, viniInteractions: 3, callLeads: 3, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 79.0,
  },
  {
    teamId: null, enterpriseName: 'Rick Case Auto Group', rooftopName: 'Rick case Alfa Romeo Maserati', agentType: 'Sales Outbound',
    totalLeads: 242, viniInteractions: 4, callLeads: 4, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 85.8,
  },
  {
    teamId: null, enterpriseName: 'McGrath Acura of Westmont (Mcgrath Imports)', rooftopName: 'McGrath Acura of Westmont', agentType: 'Sales Outbound',
    totalLeads: 1477, viniInteractions: 21, callLeads: 21, smsLeads: 0,
    appointments: 2, apptRate: 0.0952, avgScore: 66.14,
  },

  // Service Inbound (4)
  {
    teamId: null, enterpriseName: 'I 40 Auto', rooftopName: 'I 40 Autos', agentType: 'Service Inbound',
    totalLeads: 1094, viniInteractions: 367, callLeads: 67, smsLeads: 335,
    appointments: 27, apptRate: 0.0736, avgScore: 77.36,
  },
  {
    teamId: null, enterpriseName: 'Feldmann Imports, Inc.', rooftopName: 'Feldmann Imports Mercedes Benz', agentType: 'Service Inbound',
    totalLeads: 159, viniInteractions: 139, callLeads: 138, smsLeads: 0,
    appointments: 38, apptRate: 0.2734, avgScore: 67.05,
  },
  {
    teamId: null, enterpriseName: 'Edwards Chevrolet Downtown', rooftopName: 'Edwards Chevrolet 280', agentType: 'Service Inbound',
    totalLeads: 173, viniInteractions: 41, callLeads: 41, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 76.37,
  },
  {
    teamId: null, enterpriseName: 'Wolfchase Honda & Nissan', rooftopName: 'WolfChase Honda', agentType: 'Service Inbound',
    totalLeads: 169, viniInteractions: 105, callLeads: 105, smsLeads: 0,
    appointments: 2, apptRate: 0.019, avgScore: 65.88,
  },

  // Service Outbound (3)
  {
    teamId: null, enterpriseName: 'Wolfchase Honda & Nissan', rooftopName: 'WolfChase Nissan', agentType: 'Service Outbound',
    totalLeads: 80, viniInteractions: 22, callLeads: 22, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 61.5,
  },
  {
    teamId: null, enterpriseName: 'Bridgeton Auto Mall', rooftopName: 'Bridgeton Auto Mall', agentType: 'Service Outbound',
    totalLeads: 1, viniInteractions: 1, callLeads: 1, smsLeads: 0,
    appointments: 0, apptRate: 0, avgScore: 45.0,
  },
  {
    teamId: null, enterpriseName: 'James Martin Chevrolet Buick, Inc.', rooftopName: 'James Martin Chevrolet', agentType: 'Service Outbound',
    totalLeads: 1, viniInteractions: 1, callLeads: 1, smsLeads: 0,
    appointments: 1, apptRate: 1.0, avgScore: null,
  },
];

export const DEFAULT_LAST_UPDATED = 'Default data (Apr 2026)';
