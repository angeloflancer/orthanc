"use client"

import React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Home,
  FileStack,
  Users,
  Upload,
  Settings,
  LogOut,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Share2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  RefreshCw,
  Calendar,
  FileImage,
  FileText,
  Activity,
  Menu,
  X,
  Clock,
  Copy,
  Grid3X3,
  Layers,
  Box,
  Cloud,
  Send,
  Pencil,
  UserPlus,
  FolderUp,
  UserCog,
  Cog,
  Globe,
  Database,
} from "lucide-react"

// Expanded series data
const seriesData = [
  { number: 1, description: "t2_tirm_cor", modality: "MR", instances: 20 },
  { number: 2, description: "t2_tse_sag", modality: "MR", instances: 16 },
  { number: 3, description: "t2_tirm_sag", modality: "MR", instances: 16 },
  { number: 4, description: "t1_tse_sag", modality: "MR", instances: 16 },
  { number: 5, description: "t2_tse_tra", modality: "MR", instances: 46 },
]

// Sample data matching your screenshot
const studiesData = [
  {
    id: "1",
    patientBirthDate: "19570310",
    patientName: "ALAMIR^MNANI SABRI HUSNI",
    patientId: "1503323",
    studyDescription: "LOMBER^rutin",
    studyDate: "20250530",
    studyTime: "113400.027000",
    studyId: "1436667",
    studyInstanceUid: "1.2.840.113619.6.95.31.0.3.4.1.9141.13.1436667",
    requestingPhysician: "763",
    referringPhysician: "Unspecified",
    institutionName: "ANADOLU SAGLIK MERKEZI",
    hospital: "Mohammed Z...",
    uploadedBy: "Mohammed Z...",
    accessionNumber: "IBX43463853",
    seriesInstances: "5/114",
    modality: "MR",
    patientSex: "F",
    patientOtherIds: "",
    totalStudies: 2,
  },
  {
    id: "2",
    patientBirthDate: "19570310",
    patientName: "ALAMIR^MNANI SABRI HUSNI",
    patientId: "1503323",
    studyDescription: "SERVIKAL^rutin",
    studyDate: "20250530",
    studyTime: "094500.000000",
    studyId: "1436668",
    studyInstanceUid: "1.2.840.113619.6.95.31.0.3.4.1.9141.13.1436668",
    requestingPhysician: "764",
    referringPhysician: "Dr. Smith",
    institutionName: "ANADOLU SAGLIK MERKEZI",
    hospital: "Mohammed Z...",
    uploadedBy: "Mohammed Z...",
    accessionNumber: "IBX43463851",
    seriesInstances: "6/135",
    modality: "MR",
    patientSex: "F",
    patientOtherIds: "",
    totalStudies: 2,
  },
  {
    id: "3",
    patientBirthDate: "",
    patientName: "Anonymized",
    patientId: "0",
    studyDescription: "",
    studyDate: "",
    studyTime: "",
    studyId: "0",
    studyInstanceUid: "",
    requestingPhysician: "",
    referringPhysician: "",
    institutionName: "",
    hospital: "",
    uploadedBy: "Mohammed Z...",
    accessionNumber: "",
    seriesInstances: "1/1",
    modality: "OT",
    patientSex: "",
    patientOtherIds: "",
    totalStudies: 1,
  },
]

// Navigation structure with collapsible sections
const navConfig = {
  main: [
    { icon: Home, label: "Dashboard", href: "/" },
  ],
  dicomStudies: {
    icon: FileStack,
    label: "All DICOM Studies",
    children: [
      { icon: List, label: "All Studies", href: "/studies", count: 3 },
    ],
  },
  documents: { icon: FileImage, label: "All Documents", href: "/documents" },
  patients: { icon: Users, label: "All Patients", href: "/patients" },
  upload: {
    icon: Upload,
    label: "Upload",
    isUpload: true,
  },
  userManagement: { icon: UserCog, label: "User Management", href: "/user-management" },
  dicomModalities: {
    icon: Database,
    label: "DICOM Modalities",
    children: [
      { icon: Globe, label: "Modality List", href: "/modalities" },
    ],
  },
  settings: {
    icon: Settings,
    label: "Settings",
    children: [
      { icon: Cog, label: "Account Settings", href: "/settings" },
      { icon: Globe, label: "System Settings", href: "/settings/system" },
    ],
  },
}

export default function StudiesPage() {
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  
  // Collapsible nav sections
  const [expandedNavs, setExpandedNavs] = useState<string[]>(["dicomStudies"])
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false)
  
  // Filter criteria state
  const [filters, setFilters] = useState({
    patientBirthDate: "",
    patientName: "",
    patientId: "",
    studyDescription: "",
    studyDate: "",
    hospital: "",
    uploadedBy: "",
    modality: "",
    accessionNumber: "",
  })

  const toggleNav = (navKey: string) => {
    setExpandedNavs(prev => 
      prev.includes(navKey) 
        ? prev.filter(k => k !== navKey)
        : [...prev, navKey]
    )
  }

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id)
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedStudies.length === studiesData.length) {
      setSelectedStudies([])
    } else {
      setSelectedStudies(studiesData.map((s) => s.id))
    }
  }

  const toggleSelectStudy = (id: string) => {
    if (selectedStudies.includes(id)) {
      setSelectedStudies(selectedStudies.filter((s) => s !== id))
    } else {
      setSelectedStudies([...selectedStudies, id])
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—"
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    return `${year}${month}${day}`
  }

  const formatName = (name: string) => {
    if (!name) return "—"
    return name.replace(/\^/g, " ")
  }

  // Collapsible nav section component
  const CollapsibleNavSection = ({ 
    navKey, 
    icon: Icon, 
    label, 
    children,
    isActive = false 
  }: { 
    navKey: string
    icon: React.ElementType
    label: string
    children: Array<{ icon: React.ElementType; label: string; href: string; count?: number }>
    isActive?: boolean
  }) => {
    const isExpanded = expandedNavs.includes(navKey)
    return (
      <div>
        <button
          onClick={() => toggleNav(navKey)}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/30 rounded-lg transition-colors"
        >
          <Icon className="w-5 h-5" />
          <span className="flex-1 text-left">{label}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {isExpanded && (
          <ul className="ml-4 space-y-1 mt-1">
            {children.map((child) => (
              <li key={child.label}>
                <Link
                  href={child.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    child.href === "/studies"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <child.icon className="w-4 h-4" />
                  {child.label}
                  {child.count !== undefined && (
                    <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {child.count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            EMEDX
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto">
          <ul className="space-y-1">
            {/* Dashboard */}
            <li>
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Link>
            </li>

            {/* All DICOM Studies - Collapsible */}
            <li>
              <CollapsibleNavSection
                navKey="dicomStudies"
                icon={FileStack}
                label="All DICOM Studies"
                children={navConfig.dicomStudies.children}
              />
            </li>

            {/* All Documents */}
            <li>
              <Link
                href="/documents"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <FileImage className="w-5 h-5" />
                All Documents
              </Link>
            </li>

            {/* All Patients */}
            <li>
              <Link
                href="/patients"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Users className="w-5 h-5" />
                All Patients
              </Link>
            </li>

            {/* Upload - Collapsible with upload panel */}
            <li>
              <div>
                <button
                  onClick={() => setUploadPanelOpen(!uploadPanelOpen)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/30 rounded-lg transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="flex-1 text-left">Upload</span>
                  {uploadPanelOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {uploadPanelOpen && (
                  <div className="mx-2 mt-2 p-4 bg-sidebar-accent/30 rounded-lg border border-sidebar-border">
                    <div className="border-2 border-dashed border-sidebar-border rounded-lg p-4 text-center mb-3">
                      <FolderUp className="w-8 h-8 mx-auto mb-2 text-sidebar-foreground/50" />
                      <p className="text-sm text-sidebar-foreground/70">Drop files here or</p>
                      <Button size="sm" className="mt-2 rounded-full">
                        Upload DICOM
                      </Button>
                      <div className="flex justify-center gap-4 mt-3 text-xs">
                        <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground underline">
                          Select Folder
                        </button>
                        <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground underline">
                          Select Files
                        </button>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full rounded-full bg-transparent text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent">
                      Upload Document
                    </Button>
                  </div>
                )}
              </div>
            </li>

            {/* User Management */}
            <li>
              <Link
                href="/user-management"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <UserCog className="w-5 h-5" />
                User Management
              </Link>
            </li>

            {/* DICOM Modalities - Collapsible */}
            <li>
              <CollapsibleNavSection
                navKey="dicomModalities"
                icon={Database}
                label="DICOM Modalities"
                children={navConfig.dicomModalities.children}
              />
            </li>

            {/* Settings - Collapsible */}
            <li>
              <CollapsibleNavSection
                navKey="settings"
                icon={Settings}
                label="Settings"
                children={navConfig.settings.children}
              />
            </li>
          </ul>
        </nav>

        {/* Sidebar Stats - Documents Count */}
        <div className="px-4 py-6 border-t border-sidebar-border">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-sidebar-accent/50">
              <FileText className="w-5 h-5 mx-auto mb-1 text-sidebar-foreground/70" />
              <p className="text-lg font-semibold">1,247</p>
              <p className="text-xs text-sidebar-foreground/60">Documents</p>
            </div>
            <div className="p-3 rounded-lg bg-sidebar-accent/50">
              <Activity className="w-5 h-5 mx-auto mb-1 text-sidebar-foreground/70" />
              <p className="text-lg font-semibold">847</p>
              <p className="text-xs text-sidebar-foreground/60">Studies</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">All Studies</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Manage and view all DICOM studies
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="rounded-full bg-transparent">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button className="rounded-full hidden sm:flex">
                <Upload className="h-4 w-4 mr-2" />
                Upload Study
              </Button>
              <Button className="rounded-full sm:hidden" size="icon">
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="px-4 lg:px-8 pb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search patients, studies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full bg-secondary border-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full bg-transparent">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Date Range</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>Today</DropdownMenuItem>
                  <DropdownMenuItem>Last 7 days</DropdownMenuItem>
                  <DropdownMenuItem>Last 30 days</DropdownMenuItem>
                  <DropdownMenuItem>Custom range</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full bg-transparent">
                    <Filter className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Filters</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>All Modalities</DropdownMenuItem>
                  <DropdownMenuItem>CT</DropdownMenuItem>
                  <DropdownMenuItem>MR</DropdownMenuItem>
                  <DropdownMenuItem>X-Ray</DropdownMenuItem>
                  <DropdownMenuItem>Ultrasound</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="hidden sm:flex items-center border border-border rounded-full p-1">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Table Content */}
        <div className="flex-1 px-4 lg:px-8 py-6">
          {/* Selection Actions */}
          {selectedStudies.length > 0 && (
            <div className="mb-4 p-4 bg-secondary rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">{selectedStudies.length}</span> studies selected
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="rounded-full bg-transparent">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" className="rounded-full bg-transparent">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="destructive" size="sm" className="rounded-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Studies Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                {/* Column Headers */}
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedStudies.length === studiesData.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-medium hidden lg:table-cell">Birth Date</TableHead>
                  <TableHead className="font-medium">Patient Name</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">Patient ID</TableHead>
                  <TableHead className="font-medium">Study Description</TableHead>
                  <TableHead className="font-medium hidden sm:table-cell">Study Date</TableHead>
                  <TableHead className="font-medium hidden xl:table-cell">Hospital</TableHead>
                  <TableHead className="font-medium hidden xl:table-cell">Uploaded By</TableHead>
                  <TableHead className="font-medium text-center">Modality</TableHead>
                  <TableHead className="font-medium hidden lg:table-cell">Accession #</TableHead>
                  <TableHead className="font-medium hidden md:table-cell text-center"># Ser/Inst</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
                {/* Filter Criteria Row */}
                <TableRow className="bg-card hover:bg-card border-b border-border">
                  <TableCell className="py-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell">
                    <Input
                      placeholder=""
                      value={filters.patientBirthDate}
                      onChange={(e) => setFilters({ ...filters, patientBirthDate: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="John^Doe"
                      value={filters.patientName}
                      onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2 hidden md:table-cell">
                    <Input
                      placeholder="1234"
                      value={filters.patientId}
                      onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Chest"
                      value={filters.studyDescription}
                      onChange={(e) => setFilters({ ...filters, studyDescription: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2 hidden sm:table-cell">
                    <Input
                      placeholder=""
                      value={filters.studyDate}
                      onChange={(e) => setFilters({ ...filters, studyDate: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2 hidden xl:table-cell">
                    <Input
                      placeholder="Search hosp."
                      value={filters.hospital}
                      onChange={(e) => setFilters({ ...filters, hospital: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2 hidden xl:table-cell">
                    <Input
                      placeholder="Search user."
                      value={filters.uploadedBy}
                      onChange={(e) => setFilters({ ...filters, uploadedBy: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-full bg-transparent">
                          <List className="h-3 w-3 mr-1" />
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-32">
                        <DropdownMenuItem onClick={() => setFilters({ ...filters, modality: "" })}>All</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilters({ ...filters, modality: "CT" })}>CT</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilters({ ...filters, modality: "MR" })}>MR</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilters({ ...filters, modality: "OT" })}>OT</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilters({ ...filters, modality: "XR" })}>X-Ray</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell">
                    <Input
                      placeholder="1234"
                      value={filters.accessionNumber}
                      onChange={(e) => setFilters({ ...filters, accessionNumber: e.target.value })}
                      className="h-8 text-sm bg-secondary/50 border-border"
                    />
                  </TableCell>
                  <TableCell className="py-2 hidden md:table-cell" />
                  <TableCell className="py-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {studiesData.map((study) => (
                  <>
                    {/* Main Row */}
                    <TableRow
                      key={study.id}
                      className={`group cursor-pointer transition-colors ${
                        selectedStudies.includes(study.id) ? "bg-secondary" : ""
                      } ${expandedRows.includes(study.id) ? "bg-secondary/30" : ""}`}
                      onClick={() => toggleRowExpansion(study.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedStudies.includes(study.id)}
                          onCheckedChange={() => toggleSelectStudy(study.id)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {formatDate(study.patientBirthDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatName(study.patientName)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {study.patientId || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {formatName(study.studyDescription) || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {formatDate(study.studyDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden xl:table-cell">
                        {study.hospital || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden xl:table-cell">
                        {study.uploadedBy || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={study.modality === "MR" ? "default" : "secondary"}
                          className="rounded-full font-medium"
                        >
                          {study.modality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell font-mono text-xs">
                        {study.accessionNumber || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center hidden md:table-cell">
                        {study.seriesInstances}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Study
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download DICOM
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row Content */}
                    {expandedRows.includes(study.id) && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={12} className="p-0">
                          <div className="p-6 space-y-6">
                            {/* Labels Input */}
                            <div className="bg-secondary/50 rounded-lg p-3">
                              <Input 
                                placeholder="Labels to add, press Enter to create or add a new one"
                                className="bg-transparent border-0 focus-visible:ring-0 text-sm"
                              />
                            </div>

                            {/* Study and Patient Info Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Study Information */}
                              <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Study Date:</span>
                                  <span className="flex items-center gap-1">
                                    {formatDate(study.studyDate)}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Study Time:</span>
                                  <span className="flex items-center gap-1">
                                    {study.studyTime || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Study Description:</span>
                                  <span className="flex items-center gap-1">
                                    {formatName(study.studyDescription) || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Accession Number:</span>
                                  <span className="flex items-center gap-1">
                                    {study.accessionNumber || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Study ID:</span>
                                  <span className="flex items-center gap-1">
                                    {study.studyId || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Study Instance UID:</span>
                                  <span className="flex items-center gap-1 text-xs max-w-[200px] truncate">
                                    {study.studyInstanceUid || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground flex-shrink-0" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Requesting Physician:</span>
                                  <span className="flex items-center gap-1">
                                    {study.requestingPhysician || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Referring Physician Na...:</span>
                                  <span className="flex items-center gap-1">
                                    {study.referringPhysician || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Institution Name:</span>
                                  <span className="flex items-center gap-1">
                                    {study.institutionName || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                              </div>

                              {/* Patient Information */}
                              <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Patient ID:</span>
                                  <span className="flex items-center gap-1">
                                    {study.patientId || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Patient Name:</span>
                                  <span className="flex items-center gap-1">
                                    {study.patientName || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Patient Birth Date:</span>
                                  <span className="flex items-center gap-1">
                                    {formatDate(study.patientBirthDate)}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Patient Sex:</span>
                                  <span className="flex items-center gap-1">
                                    {study.patientSex || "—"}
                                    <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Patient Other IDs:</span>
                                  <span>{study.patientOtherIds || "—"}</span>
                                </div>
                                
                                {study.totalStudies > 1 && (
                                  <p className="text-sm text-primary mt-4">
                                    This patient has {study.totalStudies} studies in total..{" "}
                                    <button className="underline hover:no-underline">Show them!</button>
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-2 justify-end items-start">
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Grid3X3 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Layers className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Box className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Cloud className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <FolderUp className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-lg">
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Series Table */}
                            <div className="border border-border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-secondary/50">
                                    <TableHead className="font-medium w-32">Series Number</TableHead>
                                    <TableHead className="font-medium">Series Description</TableHead>
                                    <TableHead className="font-medium text-center w-32">Modality</TableHead>
                                    <TableHead className="font-medium text-right w-32"># Instances</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {seriesData.map((series) => (
                                    <TableRow key={series.number} className="hover:bg-secondary/30">
                                      <TableCell className="text-center">{series.number}</TableCell>
                                      <TableCell>{series.description}</TableCell>
                                      <TableCell className="text-center text-primary">{series.modality}</TableCell>
                                      <TableCell className="text-right">{series.instances}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">1-5</span> of{" "}
              <span className="font-medium text-foreground">847</span> studies
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full bg-transparent" disabled>
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((page) => (
                  <Button
                    key={page}
                    variant={page === 1 ? "default" : "ghost"}
                    size="sm"
                    className="rounded-full w-8 h-8"
                  >
                    {page}
                  </Button>
                ))}
                <span className="px-2 text-muted-foreground">...</span>
                <Button variant="ghost" size="sm" className="rounded-full w-8 h-8">
                  170
                </Button>
              </div>
              <Button variant="outline" size="sm" className="rounded-full bg-transparent">
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
