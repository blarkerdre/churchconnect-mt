export function filterMembers(members, { search = "", filters = {} } = {}) {
  const {
    status = "all",
    unit = "all",
    dateFrom = null,
    dateTo = null,
    account = "all",
    gender = "all",
    wsfCentreId = "all",
  } = filters;
  const searchTerm = search.toLowerCase();

  return members.filter((member) => {
    const searchable = `${member.first_name} ${member.last_name} ${member.email || ""} ${member.phone || ""}`.toLowerCase();
    const matchSearch = searchable.includes(searchTerm);
    const matchStatus = status === "all" || member.membership_status === status;
    const matchUnit = unit === "all" || (member.church_unit || "").toLowerCase().includes(unit.toLowerCase());
    const matchGender = gender === "all" || member.gender === gender;
    const matchDateFrom = !dateFrom || new Date(member.created_at) >= dateFrom;
    const matchDateTo = !dateTo || new Date(member.created_at) <= new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    const matchAccount = account === "all" || (account === "linked" ? !!member.user_id : !member.user_id);
    const matchWsfCentre = !wsfCentreId || wsfCentreId === "all" || member.wsf_centre_id === wsfCentreId;

    return matchSearch && matchStatus && matchUnit && matchGender && matchDateFrom && matchDateTo && matchAccount && matchWsfCentre;
  });
}

export function getMemberSummary(members) {
  return {
    total: members.length,
    active: members.filter((member) => member.membership_status === "Active").length,
    newConverts: members.filter((member) => member.membership_status === "New Convert").length,
    firstTimers: members.filter((member) => member.membership_status === "First Timer").length,
  };
}