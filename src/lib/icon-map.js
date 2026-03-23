import {
  Globe, BookOpen, ExternalLink, GraduationCap, Church, Wallet,
  Music, Video, FileText, Phone, Mail, Heart
} from "lucide-react";

export const ICON_OPTIONS = [
  { name: "Globe", label: "Globe" },
  { name: "BookOpen", label: "Book" },
  { name: "ExternalLink", label: "External Link" },
  { name: "GraduationCap", label: "Education" },
  { name: "Church", label: "Church" },
  { name: "Wallet", label: "Wallet / Giving" },
  { name: "Music", label: "Music" },
  { name: "Video", label: "Video" },
  { name: "FileText", label: "Document" },
  { name: "Phone", label: "Phone" },
  { name: "Mail", label: "Email" },
  { name: "Heart", label: "Heart" },
];

const iconMap = {
  Globe, BookOpen, ExternalLink, GraduationCap, Church, Wallet,
  Music, Video, FileText, Phone, Mail, Heart,
};

export function getIconComponent(name) {
  return iconMap[name] || ExternalLink;
}
