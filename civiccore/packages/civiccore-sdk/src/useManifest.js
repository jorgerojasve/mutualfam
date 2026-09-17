import { getManifest } from './config.js';

export const useManifest = () => {
  return getManifest() || {};
};
