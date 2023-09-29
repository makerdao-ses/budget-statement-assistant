const budgetCategoriesMap = [
    {
        canonicalCategory: 'CompensationAndBenefits',
        position: 1,
        headcountExpense: true,
        budgetCategories: ['compensation & benefits', 'contributor compensation', 'salaries & wages', 'healtcare', 'contractor (temp) fees', 'insurance', 'employer taxes', 'bonus', 'referral bonus', 'sign on bonus', 'fees & salary costs', 'contractor fees', 'salaries & benefits', 'phone']
    },
    {
        canonicalCategory: 'Bonus',
        position: 2,
        headcountExpense: true,
        budgetCategories: ['bonus', 'referral bonus', 'sign on bonus', 'sign-on bonus']
    },
    {
        canonicalCategory: 'AdminExpense',
        position: 3,
        headcountExpense: true,
        budgetCategories: ['recruiting fees']
    },
    {
        canonicalCategory: 'AdminExpense',
        position: 3,
        headcountExpense: false,
        budgetCategories: ['admin expense', 'exchange fees', 'bank fees', 'admin expenses']
    },
    {
        canonicalCategory: 'TravelAndEntertainment',
        position: 4,
        headcountExpense: true,
        budgetCategories: ['travel & entertainment', 'hotels', 'airfare', 'meals', 'activities & events', 'events', 'transportation (uber, taxi, etc.)', 'events & activities', 'activities', 'internet/online fees while traveling', 'taxi/uber/bus/train', 'hotels/airbnb', 'events/ tickets', 'lunch employee', 'travel costs']
    },
    {
        canonicalCategory: 'FreightAndDuties',
        position: 5,
        headcountExpense: false,
        budgetCategories: ['freight & duties', 'shipping & fright', 'shipping', 'fright']
    },
    {
        canonicalCategory: 'GasExpense',
        position: 6,
        headcountExpense: false,
        budgetCategories: ['gas expense', 'gas', 'gas fees']
    },
    {
        canonicalCategory: 'GovernancePrograms',
        position: 7,
        headcountExpense: false,
        budgetCategories: ['governance programs', 'programs - other', 'programs - sourcecred']
    },
    {
        canonicalCategory: 'HardwareExpense',
        position: 8,
        headcountExpense: false,
        budgetCategories: ['hardware expense']
    },
    {
        canonicalCategory: 'MarketingExpense',
        position: 9,
        headcountExpense: false,
        budgetCategories: ['marketing expense', 'marketing expenses', 'advertising', 'marketing campaign', 'maker swag', 'sponsorships', 'public relations']
    },
    {
        canonicalCategory: 'ProfessionalServices',
        position: 10,
        headcountExpense: false,
        budgetCategories: ['professional services', 'accounting expense', 'accounting expenses', 'legal expense', 'legal expenses', 'legal advice', 'contractor services', 'contractor services (professional)', 'payroll services', 'technical operations services', 'data feeds']
    },
    {
        canonicalCategory: 'SoftwareDevelopmentExpense',
        position: 11,
        headcountExpense: false,
        budgetCategories: ['software development expense', 'bug bounty', 'programs', 'programs - status ui', 'sc audit expense', 'blockchain development expense', 'web development', 'software development', 'backend', 'frontend', 'software']
    },
    {
        canonicalCategory: 'SoftwareExpense',
        position: 12,
        headcountExpense: false,
        budgetCategories: ['software expense', 'it expense', 'tooling', 'tools', 'software costs']
    },
    {
        canonicalCategory: 'Supplies',
        position: 13,
        headcountExpense: false,
        budgetCategories: ['supplies', 'office supplies']
    },
    {
        canonicalCategory: 'TrainingExpense',
        position: 14,
        headcountExpense: false,
        budgetCategories: ['training expense', 'training']
    },
    {
        canonicalCategory: 'CommunityDevelopmentExpense',
        position: 15,
        headcountExpense: false,
        budgetCategories: ['community development expense', 'grants', 'grant']
    },
    {
        canonicalCategory: 'ContingencyBuffer',
        position: 16,
        headcountExpense: false,
        budgetCategories: ['contingency buffer', 'contingency', 'buffer']
    }
]

// is headcount expense

export const isHeadcountExpense = (category: string) => {
    const budgetCategory: any = budgetCategoriesMap.find((budgetCategory) => {
        return budgetCategory.budgetCategories.includes(category.toLowerCase())
    })
    return budgetCategory ? budgetCategory.headcountExpense : false 
}

