# Kristine Tracker - Project TODO

## Database Schema
- [x] Create users table with role field (user/admin)
- [x] Create tasks table for weekly protocol tasks
- [x] Create entries table for daily check-ins
- [x] Create accommodations table for Weeks 1-2 logging only
- [x] Create reflections table for weekly reflections
- [x] Create login_activity table for tracking

## Authentication & User Management
- [x] Set up role-based access control (user/admin)
- [x] Configure Kristine as default user
- [x] Configure Jonathan as admin therapist
- [x] Track login activity for admin monitoring

## Weekly Task Protocol System
- [x] Define Week 1-2: Accommodation Log task
- [x] Define Week 3-4: 15-Minute Exit task
- [x] Define Week 5-6: Self-Care Hour task
- [x] Define Week 7-8: Validation Boundary task
- [x] Define Week 9+: Bedroom Return task
- [x] Implement task progression logic

## Daily Check-In Flow
- [x] Build check-in form with task completion toggle
- [x] Add anxiety level slider (0-10 scale)
- [x] Add guilt level slider (0-10 scale)
- [x] Add activity description text input
- [x] Add observation about Brian text input
- [x] Save entries to database

## Accommodation Log (Weeks 1-2 ONLY)
- [x] Build accommodation entry form (only visible Weeks 1-2)
- [x] Add time picker for when accommodation occurred
- [x] Add "what did you do" text input
- [x] Add "could he do it himself" radio buttons
- [x] Add "what were you feeling" text input
- [x] Display daily accommodation list
- [x] Build weekly accommodation summary with pattern analysis

## Weekly Reflection System
- [x] Create reflection form with guided questions
- [x] Week 1-2 questions about accommodation patterns
- [x] Week 3-4 questions about Brian's response to exits
- [x] Week 5-6 questions about self-care impact
- [x] Week 7-8 questions about validation boundaries
- [x] Week 9+ questions about relationship changes
- [x] Save reflections to database

## User Progress Dashboard
- [x] Display current week and task
- [x] Show weekly completion calendar
- [x] Build anxiety trend line chart
- [x] Build guilt trend line chart
- [x] Display milestone achievements
- [x] Show accommodation pattern analysis (Weeks 1-2 only)

## Admin Dashboard for Jonathan
- [x] View Kristine's activity log
- [x] Display login tracking
- [x] Show anxiety/guilt trend graphs
- [x] Display accommodation pattern analysis (Weeks 1-2)
- [x] Calculate and show completion rates
- [x] Implement red flag detection (below goal, anxiety increasing, no login 3+ days)
- [x] Add data export functionality

## Supportive Messaging System
- [x] Display contextual affirmations on home screen
- [x] Show encouragement after check-in completion
- [x] Add supportive messages throughout UI
- [x] Implement message rotation system

## Visual Theme & Mobile Optimization
- [x] Apply soft cream background (#FAF9F6)
- [x] Apply sage green primary color (#8FA998)
- [x] Apply soft lavender secondary color (#B4A7D6)
- [x] Apply charcoal gray text (#333333)
- [x] Ensure mobile-first responsive design
- [x] Test on iPhone/smartphone viewport
- [x] Add calming visual elements

## Testing & Quality Assurance
- [x] Write tests for authentication flow
- [x] Write tests for daily check-in submission
- [ ] Write tests for accommodation logging
- [ ] Write tests for reflection submission
- [ ] Write tests for admin dashboard queries
- [x] Test all user flows end-to-end

## Deployment
- [x] Create checkpoint
- [ ] Deploy to manus.space domain (user can click Publish button in UI)

## Simple Login System
- [x] Create simple login page with name/PIN options
- [x] Kristine signs in with her name
- [x] Jonathan signs in with PIN '5786'
- [x] Remove OAuth dependency for login
- [x] Ensure 100% iPhone optimization for all screens

## Bug Fixes
- [x] Fix login redirect - not navigating to home after successful login
- [x] Update login page text to mention Brian instead of 'your journey'
- [x] Change weekly calendar to start on Monday instead of Sunday

## AI Integration & Language Updates
- [x] Add AI-powered dynamic affirmations based on Kristine's current week/progress
- [x] Add AI-generated personalized feedback after check-ins
- [x] Replace 'healthier boundaries' with softer, non-triggering language
- [x] Update all defensive-triggering phrases throughout the app

## New Features - Weekly Report, TTS, Animation
- [x] Generate weekly summary report with charts after completing reflection
- [x] Add anxiety/guilt trend charts to weekly report
- [x] Add completion rate visualization to weekly report
- [x] Implement text-to-speech for AI affirmations using ElevenLabs
- [x] Add play/pause button for TTS on home screen
- [x] Add calming animation during AI feedback generation
- [x] Update check-in feedback dialog with breathing animation

## Bug Fixes - TTS
- [x] Fix ElevenLabs text-to-speech audio generation failure

## TTS Debug - Round 2
- [x] Verify ELEVENLABS_API_KEY is available in server runtime
- [x] Check frontend-to-backend TTS request flow
- [x] Add logging to trace the issue
- [x] Request API key via webdev_request_secrets tool

## PDF Export Feature
- [x] Add PDF export button to weekly summary report
- [x] Generate PDF with progress charts and summary data
- [x] Include anxiety/guilt trends and completion stats in PDF

## Journal/Notes Feature with AI
- [x] Create journal entries table in database schema
- [x] Add backend procedures for journal CRUD operations
- [x] Add AI response generation for journal entries
- [x] Build journal page UI with entry list
- [x] Add AI-powered supportive responses to each entry
- [x] Add journal link to home page navigation
