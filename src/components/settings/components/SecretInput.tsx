import React from 'react';

type SecretInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Attributes that keep password managers from treating settings fields as a login.
 * Never use type="password" in this panel — that is what triggers Save password?
 */
export const PASSWORD_MANAGER_IGNORE_PROPS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  'data-protonpass-ignore': 'true',
} as const;

export const SecretInput: React.FC<SecretInputProps> = ({ style, ...props }) => (
  <input
    {...props}
    {...PASSWORD_MANAGER_IGNORE_PROPS}
    type="text"
    inputMode="text"
    style={{ ...style, WebkitTextSecurity: 'disc' } as React.CSSProperties}
  />
);
