export const seedData = {
  profile: {
    id: 'user_1',
    courseRankWeakToStrong: ['Physics', 'Circuits', 'Chemistry'],
    studyPrefs: {
      noStudyAfter: '20:00',
      preferredBlockMins: 50,
      breakMins: 10,
      dailyTargetHours: 3,
      weeklyTargetHours: 12,
      style: 'deepwork'
    }
  },

  tasks: [
    {
      id: 'task_1',
      title: 'Physics Chapter 5 Problems',
      course: 'Physics',
      estimateHours: 3,
      hoursRemaining: 2.5,
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      priorityScore: 0.85
    },
    {
      id: 'task_2',
      title: 'Chemistry Lab Report',
      course: 'Chemistry',
      estimateHours: 2,
      hoursRemaining: 2,
      dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      priorityScore: 0.6
    },
    {
      id: 'task_3',
      title: 'Circuit Analysis Assignment',
      course: 'Circuits',
      estimateHours: 4,
      hoursRemaining: 3.5,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      priorityScore: 0.75
    },
    {
      id: 'task_4',
      title: 'Physics Midterm Prep',
      course: 'Physics',
      estimateHours: 6,
      hoursRemaining: 6,
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      priorityScore: 0.9
    },
    {
      id: 'task_5',
      title: 'Circuits Project Documentation',
      course: 'Circuits',
      estimateHours: 2.5,
      hoursRemaining: 1.5,
      dueAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      priorityScore: 0.5
    }
  ]
};

export async function initializeSeedData(storage) {
  const existingProfile = await storage.getProfile();
  if (existingProfile) {
    return false;
  }

  await storage.saveProfile(seedData.profile);
  await storage.saveTasks(seedData.tasks);
  
  console.log('✅ Seed data initialized');
  return true;
}
