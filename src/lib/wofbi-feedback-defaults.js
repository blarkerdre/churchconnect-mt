// Default field schema for the Bible School (WOFBI) course feedback form.
// Completed by students once they have finished their course exams.

export const WOFBI_FEEDBACK_FIELD_TYPES = [
  { value: "section_heading", label: "Section heading" },
  { value: "rating_grid", label: "Rating grid (satisfaction table)" },
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

export const DEFAULT_SATISFACTION_SCALE = [
  "Very satisfied",
  "Satisfied",
  "Indifferent",
  "Dissatisfied",
  "Very dissatisfied",
];

export const DEFAULT_WOFBI_FEEDBACK_FIELDS = [
  { id: "details_section", type: "section_heading", label: "Your Details (optional)" },
  { id: "feedback_date", type: "date", label: "Date" },
  { id: "first_name", type: "text", label: "First Name" },
  { id: "surname", type: "text", label: "Surname" },
  { id: "telephone", type: "tel", label: "Telephone" },
  { id: "email", type: "email", label: "Email" },

  { id: "experience_section", type: "section_heading", label: "How was your experience at Bible School?" },
  {
    id: "satisfaction",
    type: "rating_grid",
    label: "Please rate the following",
    required: true,
    rows: [
      "Spiritual impartation",
      "Practical application",
      "Course content",
      "General atmosphere",
    ],
    scale: DEFAULT_SATISFACTION_SCALE,
  },
  { id: "improvements", type: "textarea", label: "Is there any way we can improve your experience?" },

  { id: "recommend_section", type: "section_heading", label: "Based on your experience" },
  { id: "return_next_level", type: "yes_no", label: "Would you return for the next level (BCC/LCC)?" },
  { id: "would_recommend", type: "yes_no", label: "Would you recommend Bible School to your friends and family?" },
  { id: "liked_best", type: "textarea", label: "What did you like best?" },

  { id: "testimony_section", type: "section_heading", label: "Your Testimony" },
  { id: "testimony_title", type: "text", label: "Testimony Title", placeholder: "Give your testimony a title" },
  { id: "testimony", type: "textarea", label: "Share your testimony" },

  { id: "mailing_list", type: "yes_no", label: "I would like to be on the mailing list for future events" },
];

export const FEEDBACK_CONFIDENTIALITY_NOTE =
  "All information will be treated confidentially in line with data protection law.";

// Fields that must always exist on a saved form, with the field id they should sit before.
const REQUIRED_DEFAULT_FIELDS = [
  { before: "testimony", field: DEFAULT_WOFBI_FEEDBACK_FIELDS.find((f) => f.id === "testimony_title") },
];

/**
 * Merges in any core default fields missing from a tenant's saved feedback form,
 * so newly added defaults are not silently skipped for existing forms.
 */
export function mergeFeedbackDefaults(fields) {
  const list = Array.isArray(fields) ? [...fields] : [];
  if (!list.length) return list;
  REQUIRED_DEFAULT_FIELDS.forEach(({ before, field }) => {
    if (!field) return;
    if (list.some((f) => f?.id === field.id)) return;
    const idx = list.findIndex((f) => f?.id === before);
    if (idx >= 0) list.splice(idx, 0, field);
    else list.push(field);
  });
  return list;
}

