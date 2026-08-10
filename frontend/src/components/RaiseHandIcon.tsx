import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
}

/**
 * "Raise hand" glyph — a filled silhouette of a person with one arm raised,
 * matching the requested reference. Original hand-drawn SVG (head + torso +
 * raised arm), NOT third-party stock artwork. Used for the voice-room stage
 * hand badge and the raise-hand button.
 */
export const RaiseHandIcon: React.FC<Props> = ({ size = 20, color = "#FFFFFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* head */}
    <Circle cx="14.6" cy="6" r="3.8" fill={color} />
    {/* torso / bust */}
    <Path
      d="M7 21.6 C7 16 10.4 13.1 14.6 13.1 C18.8 13.1 22.2 16 22.2 21.6 Z"
      fill={color}
    />
    {/* raised arm (thick rounded limb from shoulder up to the hand) */}
    <Path
      d="M10.6 14.2 C7.9 12.8 5.6 9.9 4.9 6.8"
      fill="none"
      stroke={color}
      strokeWidth={3.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
