import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: string; size?: number };

function Base({ color, size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M5 12l5 5L20 7" />
  </Base>
);

export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Base>
);

export const ListIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Base>
);

export const QrIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
  </Base>
);

export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
);

export const UserIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
);

export const BankIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />
  </Base>
);

export const GridIcon = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="3" width="7" height="7" rx="2" />
    <Rect x="14" y="3" width="7" height="7" rx="2" />
    <Rect x="3" y="14" width="7" height="7" rx="2" />
    <Rect x="14" y="14" width="7" height="7" rx="2" />
  </Base>
);

export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Base>
);

export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Base>
);

export const WarningIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 3 2 21h20L12 3z" />
    <Path d="M12 10v5M12 18h.01" />
  </Base>
);

export const CameraIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <Circle cx="12" cy="13" r="3.5" />
  </Base>
);

export const ImageIcon = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="3" width="18" height="18" rx="3" />
    <Circle cx="9" cy="9" r="2" />
    <Path d="m21 15-5-5L5 21" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <Path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

export const MicIcon = (p: IconProps) => (
  <Base {...p}>
    <Rect x="9" y="3" width="6" height="11" rx="3" />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Base>
);
