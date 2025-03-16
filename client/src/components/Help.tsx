import React from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  MessageSquare, 
  Mail, 
  Github, 
  Twitter, 
  ExternalLink,
  FileText,
  Video,
  Coffee
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function Help() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Help & Support</h2>
        <p className="text-muted-foreground">
          Find answers to common questions and learn how to use Tiger effectively.
        </p>
      </div>

      <Tabs defaultValue="faq" className="space-y-4">
        <TabsList>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="contact">Contact Support</TabsTrigger>
        </TabsList>
        
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                Quick answers to common questions about using Tiger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a new task?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      To create a new task, navigate to the Tasks section from the sidebar. 
                      Click on the "Add Task" button at the top of the page. Fill in the task details 
                      including title, description, priority, and due date. Click "Save" to create the task.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>How do I mark a task as complete?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      To mark a task as complete, simply click the checkbox next to the task title. 
                      The task will be moved to the "Completed" section. You can also uncheck the box 
                      to mark a completed task as incomplete.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>How do I use the Pomodoro Timer?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      The Pomodoro Timer helps you work in focused intervals. Navigate to the Pomodoro 
                      section from the sidebar. Click "Start" to begin a work session (default 25 minutes). 
                      After each work session, a break timer will start. You can customize the work and 
                      break durations in the settings.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I create and manage notes?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      To create a note, go to the Notes section from the sidebar. Click the "Add Note" 
                      button. Enter a title and content for your note. You can format your notes using 
                      the rich text editor. Click "Save" to create the note. To edit a note, click on it 
                      and make your changes. You can also pin important notes to keep them at the top.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-5">
                  <AccordionTrigger>How do I schedule a meeting?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      To schedule a meeting, go to the Meetings section from the sidebar. Click "Schedule Meeting" 
                      and fill in the details including title, date, time, and participants. You can also add a 
                      location or video call link. Click "Save" to create the meeting. All scheduled meetings 
                      will appear in both the Meetings section and the Calendar.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-6">
                  <AccordionTrigger>How do notifications work?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      Tiger provides notifications for important events like upcoming tasks, meetings, and 
                      system updates. You'll see a badge on the notification bell in the top right when you 
                      have unread notifications. Click the bell to view your notifications. You can mark 
                      individual notifications as read or mark all as read. You'll also receive desktop 
                      notifications for time-sensitive items like approaching deadlines.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="guides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                User Guides
              </CardTitle>
              <CardDescription>
                Detailed guides to help you get the most out of Tiger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Getting Started with Tiger</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Learn the basics of Tiger and set up your workspace for maximum productivity.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <FileText className="h-4 w-4" />
                      Read Guide
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Task Management Mastery</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Advanced techniques for organizing tasks, setting priorities, and meeting deadlines.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <FileText className="h-4 w-4" />
                      Read Guide
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Effective Note Taking</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Strategies for creating, organizing, and retrieving notes efficiently.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <FileText className="h-4 w-4" />
                      Read Guide
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pomodoro Technique</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      How to use the Pomodoro Timer to boost focus and productivity.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <Video className="h-4 w-4" />
                      Watch Tutorial
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Contact Support
              </CardTitle>
              <CardDescription>
                Get help from our support team or connect with the community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        Email Support
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground">
                        Send us an email and we'll get back to you within 24 hours.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" size="sm" className="w-full">
                        support@tigerapp.com
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <Card className="border border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Github className="h-4 w-4 text-primary" />
                        GitHub Issues
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground">
                        Report bugs or request features on our GitHub repository.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open GitHub
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Community</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Twitter className="h-4 w-4 text-blue-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Twitter</span>
                        <span className="text-xs text-muted-foreground">@TigerApp</span>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Discord</span>
                        <span className="text-xs text-muted-foreground">Join our community</span>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Coffee className="h-4 w-4 text-amber-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">Buy us a coffee</span>
                        <span className="text-xs text-muted-foreground">Support development</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 