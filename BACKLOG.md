# Z-Health AI — Feature Backlog

## Priority 1 (Next up)

### File handling in chat
- Accept drag-and-drop files into the prompt bar (images, PDFs, CSVs, docs)
- Show file thumbnails/previews inline in chat
- Send images to AI for vision analysis (Claude supports images)
- Parse CSVs and show data tables
- Handle PDFs (extract text, summarize)
- File chips below the input showing attached files with X to remove
- Support paste from clipboard (screenshots)
- Reference: how ChatGPT, Claude.ai, and Gemini handle file uploads

### Reporting engine for Analytics workspace
- Pull real GA4 data and format as rich reports
- Tables with sortable columns
- Comparison periods (this week vs last week)
- Highlight improvements and concerns
- Export reports as PDF or CSV
- Both website and LMS properties

### Reporting engine for Keap CRM workspace
- Contact growth reports
- Tag breakdown with counts
- Revenue reports with date filtering
- Pipeline stage breakdown
- Campaign performance
- Export as PDF or CSV

## Priority 2

### Google OAuth consent screen
- Users need to re-login after analytics scope was added
- Test the full flow with @zhealth.net accounts
- Document any consent screen issues

### Workspace panel improvements
- Each workspace panel should show real-time stats at the top
- Website: pages count, drafts needing review, recent changes
- CRM: total contacts, new this week, open pipeline value
- LMS: active students, recent enrollments, course completion rates
- Analytics: traffic trend sparkline, top metric changes

### Action execution end-to-end testing
- Test create page flow fully
- Test update page flow fully
- Test SEO update flow
- Test Keap contact operations
- Test Thinkific enrollment operations
- Verify undo/snapshot works

## Priority 3

### Mobile UX
- Test and fix mobile layout
- Sidebar as bottom sheet on mobile
- Touch-friendly conversation delete (swipe)
- Responsive workspace panel

### Conversation management
- Export conversations as text/PDF
- Share conversation link (within team)
- Pin important conversations
- Archive old conversations

### Workflow improvements
- Test all pre-built workflows end-to-end
- Workflow templates for marketing campaigns
- Scheduled workflow runs

### Dark mode polish
- Verify all components look good in dark mode
- Workspace panel dark mode
- Settings panel dark mode
- All modals and overlays

## Priority 4 (Future)

### Microsoft Clarity integration
- Heatmaps data
- Session recordings count
- Rage clicks report
- Dead clicks report

### Email integration
- Send emails through Keap
- Email template builder via AI
- Campaign performance tracking

### Content calendar
- Visual calendar of scheduled posts/pages
- Drag to reschedule
- AI-suggested posting times

### Team collaboration
- See who else is online
- Conversation assignments
- Task assignments from chat

### Notification system
- Alert when pages are published
- Alert when high-traffic events happen
- Alert when pipeline deals move

### Advanced analytics
- Funnel visualization
- Cohort analysis
- Custom report builder
- Dashboard with saved widgets
