/**
 * Icon Component - 统一的图标组件
 * 使用 Tabler Icons 替代 emoji
 */

import React, { memo } from 'react';
import {
  IconPlus,
  IconRefresh,
  IconPackageExport,
  IconPackageImport,
  IconSearch,
  IconCrown,
  IconGift,
  IconCircle,
  IconCheck,
  IconBolt,
  IconHome,
  IconTrash,
  IconChartBar,
  IconEdit,
  IconX,
  IconSettings,
  IconTrendingUp,
  IconMoon,
  IconSun,
  IconPalette,
  IconPlug,
  IconChevronDown,
  IconCopy,
  IconTag,
  IconArrowsExchange,
  IconEye,
  IconAlertCircle,
  IconInfoCircle,
  IconCircleCheck,
  IconLoader,
  IconUpload,
  IconDownload,
  IconUser,
  IconMail,
  IconKey,
  IconLock,
  IconLogout,
  IconLogin,
  IconDots,
  IconFeather,
  IconAppWindow,
  IconArrowBarDown,
  IconPower,
} from '@tabler/icons-react';

export type IconName =
  | 'plus'
  | 'refresh'
  | 'export'
  | 'import'
  | 'search'
  | 'crown'
  | 'gift'
  | 'free'
  | 'check'
  | 'bolt'
  | 'home'
  | 'trash'
  | 'chart'
  | 'edit'
  | 'close'
  | 'settings'
  | 'trending'
  | 'moon'
  | 'sun'
  | 'palette'
  | 'plug'
  | 'chevron-down'
  | 'copy'
  | 'tag'
  | 'arrows-exchange'
  | 'eye'
  | 'alert'
  | 'info'
  | 'success'
  | 'loading'
  | 'upload'
  | 'download'
  | 'user'
  | 'mail'
  | 'key'
  | 'lock'
  | 'logout'
  | 'login'
  | 'dots'
  | 'feather'
  | 'window'
  | 'minimize'
  | 'power';

interface IconProps {
  name: IconName;
  size?: number | string;
  color?: string;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

const iconMap = {
  plus: IconPlus,
  refresh: IconRefresh,
  export: IconPackageExport,
  import: IconPackageImport,
  search: IconSearch,
  crown: IconCrown,
  gift: IconGift,
  free: IconCircle,
  check: IconCheck,
  bolt: IconBolt,
  home: IconHome,
  trash: IconTrash,
  chart: IconChartBar,
  edit: IconEdit,
  close: IconX,
  settings: IconSettings,
  trending: IconTrendingUp,
  moon: IconMoon,
  sun: IconSun,
  palette: IconPalette,
  plug: IconPlug,
  'chevron-down': IconChevronDown,
  copy: IconCopy,
  tag: IconTag,
  'arrows-exchange': IconArrowsExchange,
  eye: IconEye,
  alert: IconAlertCircle,
  info: IconInfoCircle,
  success: IconCircleCheck,
  loading: IconLoader,
  upload: IconUpload,
  download: IconDownload,
  user: IconUser,
  mail: IconMail,
  key: IconKey,
  lock: IconLock,
  logout: IconLogout,
  login: IconLogin,
  dots: IconDots,
  feather: IconFeather,
  window: IconAppWindow,
  minimize: IconArrowBarDown,
  power: IconPower,
};

/**
 * Icon 组件
 * 
 * @example
 * ```tsx
 * <Icon name="plus" size={16} />
 * <Icon name="refresh" size={20} color="var(--primary-color)" />
 * <Icon name="check" size="1.2em" stroke={2.5} />
 * ```
 */
export const Icon: React.FC<IconProps> = memo(({
  name,
  size = 16,
  color = 'currentColor',
  stroke = 2,
  className = '',
  style = {},
}) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      stroke={stroke}
      className={className}
      style={style}
    />
  );
});

Icon.displayName = "Icon";

// 导出常用图标组合
export { iconMap };

