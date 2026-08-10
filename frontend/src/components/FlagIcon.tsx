import React from "react";
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  Path,
  Rect,
} from "react-native-svg";

import { flagRectUrl } from "@/src/constants/languages";

interface FlagIconProps {
  code?: string | null;
  size?: number;
  testID?: string;
}

// Shield / squircle silhouette (flat rounded top, soft-pointed rounded bottom)
// drawn in a 100×100 box so the icon keeps a square footprint everywhere.
const SHIELD =
  "M22 6 H78 C88 6 95 13 95 24 V56 C95 80 74 94 50 98 C26 94 5 80 5 56 V24 C5 13 12 6 22 6 Z";

/**
 * Shield-shaped country flag (replaces the old round flag everywhere).
 * The real flag image is clipped into the shield and given a thin dark outline,
 * matching the requested "rounded shield" flag style — using free flag images
 * (flagcdn), NOT any third-party stock artwork.
 */
export const FlagIcon: React.FC<FlagIconProps> = ({
  code,
  size = 18,
  testID,
}) => {
  const uri = flagRectUrl(code);
  const clipId = `flagclip-${code || "xx"}`;

  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={SHIELD} />
        </ClipPath>
      </Defs>
      {uri ? (
        <SvgImage
          href={{ uri }}
          x={0}
          y={0}
          width={100}
          height={100}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <Rect
          x={0}
          y={0}
          width={100}
          height={100}
          fill="#CBD5E1"
          clipPath={`url(#${clipId})`}
        />
      )}
      <Path
        d={SHIELD}
        fill="none"
        stroke="#0F172A"
        strokeOpacity={0.5}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </Svg>
  );
};
