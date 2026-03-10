import React from "react";

export const TEMPLATE_ICON_TYPE_BRAND = "brand";
export const TEMPLATE_ICON_TYPE_EMOJI = "emoji";
export const TEMPLATE_BRAND_LINKEDIN = "linkedin";
export const TEMPLATE_BRAND_FACEBOOK = "facebook";
export const TEMPLATE_BRAND_INSTAGRAM = "instagram";


/* Aminah: The TemplateIcon component is a reusable component that renders either a brand icon (LinkedIn, Facebook, Instagram) or a custom emoji based on the provided props.
  It uses inline SVG for the brand icons to ensure they are crisp and scalable, while it falls back to rendering an emoji character if the icon type is not recognized or if the icon prop is a non-empty string. 
 The component also includes accessibility features by using appropriate ARIA attributes. 
 */

const LinkedInBrandIcon = ({ label = "LinkedIn logo", size = 24 }) => {
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <rect x="0" y="0" width="24" height="24" rx="3.2" fill="#0A66C2" />
      <path
        fill="#FFFFFF"
        d="M5.02 8.5H2.2V21h2.82V8.5zM3.61 7.27c.9 0 1.63-.73 1.63-1.63S4.51 4 3.61 4c-.9 0-1.63.73-1.63 1.64 0 .9.73 1.63 1.63 1.63zM21 13.83C21 10.72 20.33 8.33 16.7 8.33c-1.74 0-2.91.95-3.39 1.85h-.05V8.5h-2.7V21h2.82v-6.19c0-1.63.31-3.2 2.33-3.2 1.99 0 2.02 1.86 2.02 3.3V21H21v-7.17z"
      />
    </svg>
  );
};

/* Aminah: The FacebookBrandIcon and InstagramBrandIcon components follow a similar structure to the LinkedInBrandIcon, using inline SVG to render the respective brand logos with appropriate colors and shapes.
The TemplateIcon component then conditionally renders the correct icon based on the iconType and icon props, ensuring that it can flexibly display either brand icons or custom emojis as needed for the templates.
*/

const FacebookBrandIcon = ({ label = "Facebook logo", size = 24 }) => {
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <rect x="0" y="0" width="24" height="24" rx="3.2" fill="#1877F2" />
      <path
        fill="#FFFFFF"
        d="M14.85 8.23h2.04V5.16h-2.4c-2.84 0-4.3 1.69-4.3 4.28v1.92H8.2v2.95h1.99v6.55h3.22v-6.55h2.24l.36-2.95h-2.6V9.74c0-.85.23-1.51 1.44-1.51z"
      />
    </svg>
  );
};

/* Aminah: The InstagramBrandIcon component uses a linear gradient to create the distinctive Instagram background, along with shapes to form the camera icon. 
The TemplateIcon component checks the iconType and icon props to determine which icon to render, providing a flexible way to display either brand icons or custom emojis for the templates in the application.
*/

const InstagramBrandIcon = ({ label = "Instagram logo", size = 24 }) => {
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="35%" stopColor="#FEDA77" />
          <stop offset="55%" stopColor="#DD2A7B" />
          <stop offset="80%" stopColor="#8134AF" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="5" fill="url(#ig-gradient)" />
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.6" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.9" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
      <circle cx="16.45" cy="7.55" r="1.05" fill="#FFFFFF" />
    </svg>
  );
};

const TemplateIcon = ({
  icon,
  iconType,
  label = "Template icon",
  size = 24,
  fallbackEmoji = "📄",
}) => {
  if (iconType === TEMPLATE_ICON_TYPE_BRAND) {
    if (icon === TEMPLATE_BRAND_LINKEDIN) {
      return <LinkedInBrandIcon label={label} size={size} />;
    }

    if (icon === TEMPLATE_BRAND_FACEBOOK) {
      return <FacebookBrandIcon label={label} size={size} />;
    }

    if (icon === TEMPLATE_BRAND_INSTAGRAM) {
      return <InstagramBrandIcon label={label} size={size} />;
    }
  }

  const emoji = typeof icon === "string" && icon.trim() ? icon : fallbackEmoji;
  return (
    <span role="img" aria-label={label}>
      {emoji}
    </span>
  );
};

export default TemplateIcon;
