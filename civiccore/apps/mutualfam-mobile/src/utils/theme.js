import { getMobileEnvironmentConfig } from './env';

const envConfig = getMobileEnvironmentConfig();

export const theme = {
  screenBg: envConfig.screenBg,
  cardBg: envConfig.cardBg,
  cardBorder: envConfig.cardBorder,
  accent: envConfig.accentColor,
  tabBarBg: envConfig.tabBarBg,
  headerBg: envConfig.headerBg,
  badgeBg: envConfig.bgColor,
  badgeBorder: envConfig.borderColor,
  badgeText: envConfig.badgeText,
  color: envConfig.color,
  envKey: envConfig.key,
  isQA: envConfig.isQA,
  isProd: envConfig.isProd,
  isDev: envConfig.isDev,
  envConfig,
};

export default theme;
