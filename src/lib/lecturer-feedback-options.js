export const OPTION_LABELS = {
  session_description: {
    preaching: "Preaching",
    teaching: "Teaching",
    impartation: "Impartation",
    all: "All of them",
    none: "None of them",
  },
  delivery: {
    clear_simple: "Clear & Simple",
    interactive: "Interactive",
    just_right: "Just right",
    not_clear: "Not clear",
    difficult: "Difficult to understand",
  },
  time_keeping: {
    on_time: "On time",
    too_long: "Too long",
    too_short: "Too short",
    just_right: "Just right",
    not_sure: "Not sure",
  },
  class_atmosphere: {
    in_control: "In control of the class",
    unable_to_control: "Unable to control the class",
    balance_right: "The balance was right",
    not_sure: "Not sure",
  },
  test_quality: {
    too_hard: "Too hard",
    too_simple: "Too simple",
    just_right: "Just right",
    not_sure: "Not sure",
  },
  have_again: {
    yes: "Yes",
    no: "No",
    maybe: "Maybe",
    never: "Never",
    unsure: "Unsure",
  },
};

export const CATEGORICAL_FIELDS = [
  { key: "session_description", label: "Session" },
  { key: "delivery", label: "Delivery" },
  { key: "time_keeping", label: "Time keeping" },
  { key: "class_atmosphere", label: "Class atmosphere" },
  { key: "test_quality", label: "Test quality" },
  { key: "have_again", label: "Have again" },
];
