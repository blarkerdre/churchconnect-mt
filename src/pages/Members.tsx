import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const membersData = [
  { id: 1, name: "Sarah Johnson", email: "sarah@email.com", phone: "(555) 123-4567", role: "Volunteer", group: "Worship Team", status: "Active" },
  { id: 2, name: "Michael Chen", email: "michael@email.com", phone: "(555) 234-5678", role: "Member", group: "Men's Ministry", status: "Active" },
  { id: 3, name: "Emily Davis", email: "emily@email.com", phone: "(555) 345-6789", role: "Youth Leader", group: "Youth Ministry", status: "Active" },
  { id: 4, name: "James Wilson", email: "james@email.com", phone: "(555) 456-7890", role: "Deacon", group: "Leadership", status: "Active" },
  { id: 5, name: "Maria Garcia", email: "maria@email.com", phone: "(555) 567-8901", role: "Choir Member", group: "Choir", status: "Active" },
  { id: 6, name: "David Brown", email: "david@email.com", phone: "(555) 678-9012", role: "Member", group: "Small Groups", status: "Inactive" },
  { id: 7, name: "Lisa Anderson", email: "lisa@email.com", phone: "(555) 789-0123", role: "Sunday School Teacher", group: "Children's Ministry", status: "Active" },
  { id: 8, name: "Robert Taylor", email: "robert@email.com", phone: "(555) 890-1234", role: "Elder", group: "Leadership", status: "Active" },
];

export default function Members() {
  const [search, setSearch] = useState("");
  const filtered = membersData.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.group.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-1">{membersData.length} total members in your church</p>
        </div>
        <Button className="gap-2 self-start">
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members, roles, groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Group</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{member.email}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{member.phone}</td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="font-normal">{member.group}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={member.status === "Active" ? "default" : "outline"} className="font-normal">
                      {member.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">No members found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
