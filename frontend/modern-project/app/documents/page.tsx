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
import { Home, FileStack, Users, Upload, Settings, LogOut, Search, Filter, MoreVertical, Eye, Download, Trash2, ChevronDown, ChevronUp, LayoutGrid, List, RefreshCw, Calendar, FileImage, FileText, Activity, Menu, X, File, FilePen as FilePdf, FileSpreadsheet, UserCog, Database, Cog, Globe, FolderUp } from "lucide-react"

// Sample documents data
const documentsData = [
  {
    id: "1",
    name: "Patient Report - ALAMIR MNANI.pdf",
    type: "PDF",
    size: "2.4 MB",
    uploadedBy: "Dr. Smith",
    uploadDate: "2025-05-30",
    patientId: "1503323",
    patientName: "ALAMIR MNANI SABRI HUSNI",
  },
  {
    id: "2",
    name: "Lab Results - Blood Work.pdf",
    type: "PDF",
    size: "1.2 MB",
    uploadedBy: "Lab Tech",
    uploadDate: "2025-05-29",
    patientId: "1503323",
    patientName: "ALAMIR MNANI SABRI HUSNI",
  },
  {
    id: "3",
    name: "MRI Analysis Report.docx",
    type: "DOCX",
    size: "890 KB",
    uploadedBy: "Dr. Johnson",
    uploadDate: "2025-05-28",
    patientId: "2847291",
    patientName: "SMITH JOHN WILLIAM",
  },
  {
    id: "4",
    name: "Treatment Plan.xlsx",
    type: "XLSX",
    size: "456 KB",
    uploadedBy: "Dr. Williams",
    uploadDate: "2025-05-27",
    patientId: "3948172",
    patientName: "JOHNSON SARAH MARIE",
  },
  {
    id: "5",
    name: "Consent Form - Signed.pdf",
    type: "PDF",
    size: "125 KB",
    uploadedBy: "Reception",
    uploadDate: "2025-05-26",
    patientId: "1503323",
    patientName: "ALAMIR MNANI SABRI HUSNI",
  },
]

// Navigation structure
const navConfig = {
  dicomStudies: {
    icon: FileStack,
    label: "All DICOM Studies",
    children: [
      { icon: List, label: "All Studies", href: "/studies", count: 3 },
    ],
  },
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

const getFileIcon = (type: string) => {
  switch (type) {
    case "PDF":
      return <FileText className="h-5 w-5 text-red-500" />
    case "DOCX":
      return <File className="h-5 w-5 text-blue-500" />
    case "XLSX":
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    default:
      return <FileImage className="h-5 w-5 text-muted-foreground" />
  }
}

export default function DocumentsPage() {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedNavs, setExpandedNavs] = useState<string[]>(["dicomStudies"])
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false)

  const toggleNav = (navKey: string) => {
    setExpandedNavs(prev => 
      prev.includes(navKey) 
        ? prev.filter(k => k !== navKey)
        : [...prev, navKey]
    )
  }

  const toggleSelectAll = () => {
    if (selectedDocs.length === documentsData.length) {
      setSelectedDocs([])
    } else {
      setSelectedDocs(documentsData.map((d) => d.id))
    }
  }

  const toggleSelectDoc = (id: string) => {
    if (selectedDocs.includes(id)) {
      setSelectedDocs(selectedDocs.filter((d) => d !== id))
    } else {
      setSelectedDocs([...selectedDocs, id])
    }
  }

  const CollapsibleNavSection = ({ 
    navKey, 
    icon: Icon, 
    label, 
    children 
  }: { 
    navKey: string
    icon: React.ElementType
    label: string
    children: Array<{ icon: React.ElementType; label: string; href: string; count?: number }>
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
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {isExpanded && (
          <ul className="ml-4 space-y-1 mt-1">
            {children.map((child) => (
              <li key={child.label}>
                <Link
                  href={child.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
            <li>
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Link>
            </li>

            <li>
              <CollapsibleNavSection
                navKey="dicomStudies"
                icon={FileStack}
                label="All DICOM Studies"
                children={navConfig.dicomStudies.children}
              />
            </li>

            <li>
              <Link
                href="/documents"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors bg-sidebar-accent text-sidebar-accent-foreground"
              >
                <FileImage className="w-5 h-5" />
                All Documents
              </Link>
            </li>

            <li>
              <Link
                href="/patients"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Users className="w-5 h-5" />
                All Patients
              </Link>
            </li>

            <li>
              <div>
                <button
                  onClick={() => setUploadPanelOpen(!uploadPanelOpen)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/30 rounded-lg transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="flex-1 text-left">Upload</span>
                  {uploadPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {uploadPanelOpen && (
                  <div className="mx-2 mt-2 p-4 bg-sidebar-accent/30 rounded-lg border border-sidebar-border">
                    <div className="border-2 border-dashed border-sidebar-border rounded-lg p-4 text-center mb-3">
                      <FolderUp className="w-8 h-8 mx-auto mb-2 text-sidebar-foreground/50" />
                      <p className="text-sm text-sidebar-foreground/70">Drop files here or</p>
                      <Button size="sm" className="mt-2 rounded-full">Upload DICOM</Button>
                      <div className="flex justify-center gap-4 mt-3 text-xs">
                        <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground underline">Select Folder</button>
                        <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground underline">Select Files</button>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full rounded-full bg-transparent text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent">
                      Upload Document
                    </Button>
                  </div>
                )}
              </div>
            </li>

            <li>
              <Link
                href="/user-management"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <UserCog className="w-5 h-5" />
                User Management
              </Link>
            </li>

            <li>
              <CollapsibleNavSection
                navKey="dicomModalities"
                icon={Database}
                label="DICOM Modalities"
                children={navConfig.dicomModalities.children}
              />
            </li>

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
                <h1 className="text-xl font-semibold text-foreground">All Documents</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Manage patient documents and reports
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="rounded-full bg-transparent">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button className="rounded-full hidden sm:flex">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </div>

          <div className="px-4 lg:px-8 pb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full bg-secondary border-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full bg-transparent">
                    <Filter className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Type</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>All Types</DropdownMenuItem>
                  <DropdownMenuItem>PDF</DropdownMenuItem>
                  <DropdownMenuItem>DOCX</DropdownMenuItem>
                  <DropdownMenuItem>XLSX</DropdownMenuItem>
                  <DropdownMenuItem>Images</DropdownMenuItem>
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

        <div className="flex-1 px-4 lg:px-8 py-6">
          {selectedDocs.length > 0 && (
            <div className="mb-4 p-4 bg-secondary rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">{selectedDocs.length}</span> documents selected
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="rounded-full bg-transparent">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="destructive" size="sm" className="rounded-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDocs.length === documentsData.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-medium">Document Name</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">Type</TableHead>
                  <TableHead className="font-medium hidden lg:table-cell">Size</TableHead>
                  <TableHead className="font-medium hidden xl:table-cell">Patient</TableHead>
                  <TableHead className="font-medium hidden sm:table-cell">Uploaded By</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentsData.map((doc) => (
                  <TableRow key={doc.id} className="group cursor-pointer transition-colors">
                    <TableCell>
                      <Checkbox
                        checked={selectedDocs.includes(doc.id)}
                        onCheckedChange={() => toggleSelectDoc(doc.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.type)}
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="rounded-full">
                        {doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {doc.size}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div>
                        <p className="font-medium text-sm">{doc.patientName}</p>
                        <p className="text-xs text-muted-foreground">ID: {doc.patientId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {doc.uploadedBy}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {doc.uploadDate}
                    </TableCell>
                    <TableCell>
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
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">1-5</span> of{" "}
              <span className="font-medium text-foreground">1,247</span> documents
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
                  250
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
