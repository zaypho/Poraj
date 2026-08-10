import React from "react";
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  Path,
  Rect,
} from "react-native-svg";

import { countryFlagRectUrl } from "@/src/constants/countries";
import { flagRectUrl } from "@/src/constants/languages";

// Shield / squircle silhouette (flat rounded top, soft-pointed rounded bottom)
// drawn in a 100×100 box so every flag keeps a square footprint everywhere.
const SHIELD =
  "M22 6 H78 C88 6 95 13 95 24 V56 C95 80 74 94 50 98 C26 94 5 80 5 56 V24 C5 13 12 6 22 6 Z";

/** Core shield renderer: clips a rectangular flag image into the shield shape
 *  and adds a thin dark outline — the requested "rounded shield" flag look. */
const ShieldFlag: React.FC<{
  uri: string | null;
  size: number;
  idKey: string;
  testID?: string;
}> = ({ uri, size, idKey, testID }) => {
  const clipId = `flagclip-${idKey}`;
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

interface FlagIconProps {
  /** language code (e.g. "en", "es") */
  code?: string | null;
  size?: number;
  testID?: string;
}

/** Shield-shaped flag by LANGUAGE code (used across the whole app). */
export const FlagIcon: React.FC<FlagIconProps> = ({
  code,
  size = 18,
  testID,
}) => (
  <ShieldFlag
    uri={flagRectUrl(code)}
    size={size}
    idKey={`l-${code || "xx"}`}
    testID={testID}
  />
);

interface CountryFlagIconProps {
  /** ISO-2 country code (e.g. "us", "bd") */
  country?: string | null;
  size?: number;
  testID?: string;
}

/** Shield-shaped flag by COUNTRY code (avatars, profiles, country pickers). */
export const CountryFlagIcon: React.FC<CountryFlagIconProps> = ({
  country,
  size = 18,
  testID,
}) => (
  <ShieldFlag
    uri={countryFlagRectUrl(country)}
    size={size}
    idKey={`c-${country || "xx"}`}
    testID={testID}
  />
);
