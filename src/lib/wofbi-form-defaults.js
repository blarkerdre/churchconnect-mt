// Default field schema for the Bible School (WOFBI) application form.
// Mirrors the paper form fields. Field IDs are stable keys used in answers JSON.

export const WOFBI_FIELD_TYPES = [
  { value: "section_heading", label: "Section heading" },
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Radio (single choice)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "yes_no", label: "Yes / No" },
];

export const DEFAULT_WOFBI_FIELDS = [
  { id: "personal", type: "section_heading", label: "Personal Details" },
  { id: "gender", type: "radio", label: "Gender", required: true, options: ["M", "F"] },
  { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
  { id: "nationality", type: "text", label: "Nationality" },
  { id: "marital_status", type: "radio", label: "Marital Status", options: ["Married", "Single", "Other"] },
  { id: "address", type: "textarea", label: "Address", required: true },
  { id: "post_code", type: "text", label: "Post Code" },
  { id: "tel", type: "tel", label: "Telephone" },

  { id: "employment_section", type: "section_heading", label: "Employment & Education" },
  { id: "employed", type: "yes_no", label: "Are you employed?" },
  { id: "occupation", type: "text", label: "If yes, what is your occupation?" },
  { id: "academic_background", type: "textarea", label: "Academic Background" },

  { id: "faith_section", type: "section_heading", label: "Faith Journey" },
  { id: "born_again", type: "yes_no", label: "Are you born again?", required: true },
  { id: "born_again_when", type: "text", label: "When did you become born again?" },
  { id: "born_again_where", type: "text", label: "Where did you become born again?" },
  { id: "current_place_of_worship", type: "text", label: "Current Place of Worship", required: true },
  { id: "pastor_name", type: "text", label: "Name of Your Pastor" },
  { id: "pastor_address", type: "textarea", label: "Pastor's Address / Church Address" },
  { id: "present_activity_group", type: "text", label: "Present Activity Group / Unit" },

  { id: "prior_section", type: "section_heading", label: "Previous Training" },
  { id: "prior_bible_college", type: "yes_no", label: "Any previous Bible college or training college for ministry?" },
  { id: "prior_bible_college_details", type: "textarea", label: "If yes, list school attended, dates, and certificate obtained" },

  { id: "family_section", type: "section_heading", label: "Family" },
  { id: "coming_with_children", type: "yes_no", label: "Are you coming with children?" },
  { id: "children_details", type: "textarea", label: "If yes, how many and their ages?" },

  { id: "referral_section", type: "section_heading", label: "How Did You Hear About Us?" },
  { id: "heard_about", type: "select", label: "How did you hear about the Bible School?", options: [
    "Church announcement",
    "Website",
    "Graduation ceremony",
    "Friend",
    "Graduate's recommendation",
    "Other",
  ] },
  { id: "referrer_details", type: "text", label: "If Friend or Graduate: name and telephone number" },

  { id: "declaration_section", type: "section_heading", label: "Declaration" },
  { id: "declaration_name", type: "text", label: "Full name (for declaration)", required: true, help_text: "I solemnly declare that the above information is true and correct to the best of my knowledge, and I agree to abide by the rules and regulations of the Bible School." },
  { id: "declaration_agree", type: "checkbox", label: "I agree to the declaration above", required: true },
];
