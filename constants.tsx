
import React from 'react';
import { CheckpointResult, User } from './types';

// Adding isMandatory: true and manual numbering to labels to ensure consistency with the new bulk upload format
export const FQC_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'fqc_01', label: '1. Check for outer body – no scratches, cracks, dents (Top & Bottom Panel)', isMandatory: true },
  { id: 'fqc_02', label: '2. Check for all 7 screws properly mounted', isMandatory: true },
  { id: 'fqc_03', label: '3. Check for keypad – all buttons present as per layout, symbols clear and legible', isMandatory: true },
  { id: 'fqc_04', label: '4. Check display segment placement with Tohands logo and protective film attached; no dent, scratches, or gap between display and top cover', isMandatory: true },
  { id: 'fqc_05', label: '5. Check for laser marking: Smart Calculator V5 Powered by AI', isMandatory: true },
  { id: 'fqc_06', label: '6. Check both C-Type USB pin connectors – Charging (Right side) & Printer (Left side)', isMandatory: true },
  { id: 'fqc_07', label: '7. Verify LED light working during Power ON and charger connectivity', isMandatory: true },
  { id: 'fqc_08', label: '8. Display turns ON properly – no missing segments / black spots, proper brightness and contrast', isMandatory: true },
  { id: 'fqc_09', label: '9. Check Device ID verification with respect to System Info and Device Label', isMandatory: true },
  { id: 'fqc_10', label: '10. Observe speaker sound and voice quality', isMandatory: true },
  { id: 'fqc_11', label: '11. Check battery cover properly fixed and sticker position as per standard', isMandatory: true },
  { id: 'fqc_12', label: '12. Check label content clearly printed', isMandatory: true },
];

export const PACKAGING_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'pkg_01', label: '1. Verify that the Device ID matches exactly across all three references: Internal Device ID (Calculator), Device ID on the bottom panel of the device, Device ID on the outer box label', isMandatory: true },
  { id: 'pkg_02', label: '2. Ensure the protective case is properly attached to the device', isMandatory: true },
  { id: 'pkg_03', label: '3. Verify the device is correctly placed inside the white device sleeve with logo, and ensure proper logo alignment', isMandatory: true },
  { id: 'pkg_04', label: '4. Confirm Packing Box Insert – 1 is present inside the packaging box', isMandatory: true },
  { id: 'pkg_05', label: '5. Verify the charging adapter and power cable (Type-C to Type-C) are correctly packed in Packing Box Insert – 2', isMandatory: true },
  { id: 'pkg_06', label: '6. Ensure the user manual / quick start guide is available inside the box', isMandatory: true },
  { id: 'pkg_07', label: '7. Verify the packaging box is properly closed and sealed using two circular package seal stickers', isMandatory: true },
  { id: 'pkg_08', label: '8. Ensure the closed box is covered with the packing sleeve (green & white) as per standard', isMandatory: true },
  { id: 'pkg_09', label: '9. Confirm the box is fully closed and secured by applying the wrapping cover', isMandatory: true },
  { id: 'pkg_10', label: '10. Verify the packed box weight falls within the approved acceptable range', isMandatory: true },
];

export const INITIAL_ADMIN_USER: User = {
  userId: 'admin',
  password: '123',
  isAdmin: true,
  isActive: true,
  assignedStage: 'FQC'
};
