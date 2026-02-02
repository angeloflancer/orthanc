"use client"

import React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Home,
  FileStack,
  Users,
  Upload,
  Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  List,
  FileImage,
  FileText,
  Activity,
  Menu,
  X,
  UserCog,
  Database,
  Cog,
  Globe,
  FolderUp,
  User,
  Bell,
  Lock,
  Palette,
  Save,
  Camera,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedNavs, setExpandedNavs] = useState<string[]>(["settings"])
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")

  // Form states
  const [profile, setProfile] = useState({
    firstName: "Mohammed",
    lastName: "Zaman",
    email: "m.zaman@emedx.com",
    phone: "+1 234 567 8901",
    department: "Radiology",
    title: "Chief Radiologist",
  })

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    newStudyAlerts: true,
    systemUpdates: false,
    weeklyReport: true,
  })

  const toggleNav = (navKey: string) => {
    setExpandedNavs(prev => 
      prev.includes(navKey) 
        ? prev.filter(k => k !== navKey)
        : [...prev, navKey]
    )
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
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    child.href === "/settings"
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

  const settingsTabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "appearance", label: "Appearance", icon: Palette },
  ]

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
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
                <h1 className="text-xl font-semibold text-foreground">Account Settings</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Manage your account preferences
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 lg:px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Settings Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {settingsTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  className="rounded-full bg-transparent flex items-center gap-2"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal information and profile picture</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">MZ</AvatarFallback>
                        </Avatar>
                        <Button size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <h3 className="font-medium">Profile Photo</h3>
                        <p className="text-sm text-muted-foreground">JPG, PNG or GIF. Max 2MB</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={profile.firstName}
                          onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={profile.lastName}
                          onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select value={profile.department} onValueChange={(value) => setProfile({ ...profile, department: value })}>
                          <SelectTrigger className="rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Radiology">Radiology</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                            <SelectItem value="Lab">Lab</SelectItem>
                            <SelectItem value="Surgery">Surgery</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">Job Title</Label>
                        <Input
                          id="title"
                          value={profile.title}
                          onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button className="rounded-full">
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Choose how you want to be notified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notifications.emailNotifications}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, emailNotifications: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Study Alerts</p>
                      <p className="text-sm text-muted-foreground">Get notified when new studies are uploaded</p>
                    </div>
                    <Switch
                      checked={notifications.newStudyAlerts}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, newStudyAlerts: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">System Updates</p>
                      <p className="text-sm text-muted-foreground">Receive system maintenance notifications</p>
                    </div>
                    <Switch
                      checked={notifications.systemUpdates}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, systemUpdates: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">Receive weekly activity summary</p>
                    </div>
                    <Switch
                      checked={notifications.weeklyReport}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your password to keep your account secure</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" className="rounded-lg max-w-md" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" className="rounded-lg max-w-md" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" className="rounded-lg max-w-md" />
                    </div>
                    <Button className="rounded-full">Update Password</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                    <CardDescription>Add an extra layer of security to your account</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable 2FA</p>
                        <p className="text-sm text-muted-foreground">Use an authenticator app for additional security</p>
                      </div>
                      <Button variant="outline" className="rounded-full bg-transparent">Enable</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize the look and feel of the application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select defaultValue="light">
                      <SelectTrigger className="rounded-lg max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger className="rounded-lg max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select defaultValue="yyyy-mm-dd">
                      <SelectTrigger className="rounded-lg max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                        <SelectItem value="dd-mm-yyyy">DD-MM-YYYY</SelectItem>
                        <SelectItem value="mm-dd-yyyy">MM-DD-YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
