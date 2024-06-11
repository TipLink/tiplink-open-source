import base58 from "bs58";

import { TipLink } from '../index';

export interface Themeable {
  themeId?: number;
}

const createObscureThemeId = (themeId: number) => {
  return base58.encode(Buffer.from(`theme|${themeId}`));
};

export const attachTheme = (tiplink: TipLink, themeId?: number) => {
  if (!themeId) {
    return tiplink;
  }
  const obscureThemeId = createObscureThemeId(themeId);
  tiplink.url.searchParams.append("t", obscureThemeId);
  tiplink.url.pathname = "/ti";
  return tiplink;
};

