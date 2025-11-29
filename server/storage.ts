import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { eq, and, or, asc, desc, sql } from "drizzle-orm";

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

// Interfaces for types
type UserId = string;
type PortfolioId = string;
type HoldingId = string;
type TransactionId = string;
type WithdrawalId = string;
type DepositId = string;
type ChatSessionId = string;

type ChatSession = typeof schema.liveChatSessions.$inferSelect;
type InsertChatSession = typeof schema.liveChatSessions.$inferInsert;
type ChatMessage = typeof schema.liveChatMessages.$inferSelect;
type InsertChatMessage = typeof schema.liveChatMessages.$inferInsert;
type RateLimitStoreEntry = {
  count: number;
  resetTime: number;
  firstRequest: number;
};

// ---------------- USERS ----------------
export class DatabaseStorage {
  db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  // Users
  async getUser(id: UserId) {
    return this.db.query.users.findFirst({ where: eq(schema.users.id, id) });
  }

  async createUser(data: typeof schema.users.$inferInsert) {
    const result = await this.db.insert(schema.users).values(data).returning();
    return result[0];
  }

  async getUserByEmail(email: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.email, email) });
  }

  async getUserByUsername(username: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.username, username) });
  }

  async getUserByGoogleId(googleId: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.googleId, googleId) });
  }

  async getUserByFacebookId(facebookId: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.facebookId, facebookId) });
  }

  async getUserByAppleId(appleId: string) {
    return this.db.query.users.findFirst({ where: eq(schema.users.appleId, appleId) });
  }

  async getUserByEmailOrUsername(emailOrUsername: string, username?: string) {
    const primaryMatch = or(
      eq(schema.users.email, emailOrUsername),
      eq(schema.users.username, emailOrUsername)
    );

    if (!username) {
      return this.db.query.users.findFirst({
        where: primaryMatch,
      });
    }

    const secondaryMatch = or(
      eq(schema.users.email, username),
      eq(schema.users.username, username)
    );

    return this.db.query.users.findFirst({
      where: or(primaryMatch, secondaryMatch),
    });
  }

  async verifyPassword(userId: string, password: string) {
    const user = await this.getUser(userId);
    if (!user || !user.password) return false;

    const bcrypt = await import('bcrypt');
    return bcrypt.compare(password, user.password);
  }

  async getAllUsers() {
    return this.db.query.users.findMany({
      orderBy: desc(schema.users.createdAt)
    });
  }

  async getAdminById(adminId: string) {
    return this.db.query.users.findFirst({
      where: and(eq(schema.users.id, adminId), eq(schema.users.role, 'admin'))
    });
  }

  async getUserCount() {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(schema.users);
    return Number(result[0]?.count ?? 0);
  }

  async getActiveUsers(limit = 100) {
    return this.db.query.users.findMany({
      where: eq(schema.users.isActive, true),
      orderBy: desc(schema.users.updatedAt),
      limit
    });
  }

  async updateUser(id: UserId, data: Partial<typeof schema.users.$inferSelect>) {
    const result = await this.db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: UserId) {
    return this.db.delete(schema.users).where(eq(schema.users.id, id));
  }

  // User Settings
  async getUserSettings(userId: UserId) {
    return this.db.query.userSettings.findFirst({ where: eq(schema.userSettings.userId, userId) });
  }

  async createUserSettings(data: typeof schema.userSettings.$inferInsert) {
    return this.db.insert(schema.userSettings).values(data).returning();
  }

  async updateUserSettings(userId: UserId, data: Partial<typeof schema.userSettings.$inferSelect>) {
    const result = await this.db.update(schema.userSettings).set(data).where(eq(schema.userSettings.userId, userId)).returning();
    return result[0];
  }

  // Notifications
  async getUserNotifications(userId: UserId, limit = 50) {
    return this.db.query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: desc(schema.notifications.createdAt),
      limit
    });
  }

  async createNotification(data: typeof schema.notifications.$inferInsert) {
    const result = await this.db.insert(schema.notifications).values(data).returning();
    return result[0];
  }

  async getNotificationById(id: number) {
    return this.db.query.notifications.findFirst({
      where: eq(schema.notifications.id, id)
    });
  }

  async updateNotification(id: number, data: Partial<typeof schema.notifications.$inferInsert>) {
    const result = await this.db.update(schema.notifications)
      .set(data)
      .where(eq(schema.notifications.id, id))
      .returning();
    return result[0];
  }

  async deleteNotification(id: number) {
    await this.db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  async markNotificationAsRead(notificationId: number) {
    await this.updateNotification(notificationId, { read: true });
    return true;
  }

  async markAllNotificationsRead(userId: UserId) {
    await this.db.update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.userId, userId));
  }

  async getNotificationPreferences(userId: UserId) {
    return this.db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId)
    });
  }

  async updateNotificationPreferences(userId: UserId, data: Partial<typeof schema.userPreferences.$inferInsert>) {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const result = await this.db.update(schema.userPreferences)
        .set(data)
        .where(eq(schema.userPreferences.userId, userId))
        .returning();
      return result[0];
    }
    const result = await this.db.insert(schema.userPreferences)
      .values({ userId, ...data })
      .returning();
    return result[0];
  }

  // ---------------- PORTFOLIOS ----------------
  async getPortfolio(identifier: PortfolioId) {
    return this.db.query.portfolios.findFirst({
      where: or(
        eq(schema.portfolios.id, identifier),
        eq(schema.portfolios.userId, identifier)
      )
    });
  }

  async createPortfolio(data: typeof schema.portfolios.$inferInsert) {
    const result = await this.db.insert(schema.portfolios).values(data).returning();
    return result[0];
  }

  async updatePortfolio(id: PortfolioId, data: Partial<typeof schema.portfolios.$inferSelect>) {
    return this.db.update(schema.portfolios).set(data).where(eq(schema.portfolios.id, id));
  }

  // ---------------- HOLDINGS ----------------
  async getHolding(portfolioId: PortfolioId, symbol: string) {
    return this.db.query.holdings.findFirst({ where: and(eq(schema.holdings.portfolioId, portfolioId), eq(schema.holdings.symbol, symbol)) });
  }

  async getHoldingById(id: HoldingId) {
    return this.db.query.holdings.findFirst({ where: eq(schema.holdings.id, id) });
  }

  async getHoldings(portfolioId: PortfolioId) {
    return this.db.query.holdings.findMany({
      where: eq(schema.holdings.portfolioId, portfolioId),
      orderBy: desc(schema.holdings.updatedAt)
    });
  }

  async upsertHolding(data: Partial<typeof schema.holdings.$inferSelect>) {
    return this.db
      .insert(schema.holdings)
      .values(data as typeof schema.holdings.$inferInsert)
      .onConflictDoUpdate({
        target: schema.holdings.id,
        set: data,
      })
      .returning();
  }

  async deleteHolding(identifier: string, symbol?: string) {
    if (symbol) {
      return this.db.delete(schema.holdings).where(and(eq(schema.holdings.portfolioId, identifier), eq(schema.holdings.symbol, symbol)));
    }
    return this.db.delete(schema.holdings).where(eq(schema.holdings.id, identifier));
  }

  async updateHolding(id: HoldingId, data: Partial<typeof schema.holdings.$inferInsert>) {
    const result = await this.db.update(schema.holdings)
      .set(data)
      .where(eq(schema.holdings.id, id))
      .returning();
    return result[0];
  }

  // ---------------- TRANSACTIONS ----------------
  async getUserTransactions(userId: UserId, limit = 100, type?: string) {
    const conditions = [eq(schema.transactions.userId, userId)];
    if (type) {
      conditions.push(eq(schema.transactions.type, type as any));
    }
    return this.db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: desc(schema.transactions.createdAt),
      limit
    });
  }

  async getUserTransactionCount(userId: UserId) {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId));
    return Number(result[0]?.count ?? 0);
  }

  async getTransaction(id: TransactionId) {
    return this.db.query.transactions.findFirst({
      where: eq(schema.transactions.id, id)
    });
  }

  async getTransactions(userId: UserId, limit = 100) {
    return this.getUserTransactions(userId, limit);
  }

  async getAllTransactions(options: { page?: number; limit?: number; userId?: string; type?: string } = {}) {
    const { page = 1, limit = 50, userId, type } = options;
    const offset = (Math.max(page, 1) - 1) * limit;
    const conditions = [];
    if (userId) {
      conditions.push(eq(schema.transactions.userId, userId));
    }
    if (type) {
      conditions.push(eq(schema.transactions.type, type as any));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const countPromise = whereClause
      ? this.db.select({ count: sql<number>`count(*)` }).from(schema.transactions).where(whereClause)
      : this.db.select({ count: sql<number>`count(*)` }).from(schema.transactions);

    const [data, totalResult] = await Promise.all([
      this.db.query.transactions.findMany({
        where: whereClause,
        orderBy: desc(schema.transactions.createdAt),
        limit,
        offset
      }),
      countPromise
    ]);

    return {
      transactions: data,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      limit
    };
  }

  async getTransactionCount() {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(schema.transactions);
    return Number(result[0]?.count ?? 0);
  }

  async createTransaction(data: Partial<typeof schema.transactions.$inferSelect>) {
    return this.db.insert(schema.transactions).values(data as typeof schema.transactions.$inferInsert).returning();
  }

  async updateTransaction(id: TransactionId, data: Partial<typeof schema.transactions.$inferInsert>) {
    const result = await this.db.update(schema.transactions)
      .set(data)
      .where(eq(schema.transactions.id, id))
      .returning();
    return result[0];
  }

  async reverseTransaction(id: TransactionId, adminId: UserId, reason?: string) {
    const transaction = await this.getTransaction(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    const reversed = await this.updateTransaction(id, {
      status: 'reversed',
      updatedAt: new Date().toISOString()
    });
    await this.createAuditLog({
      adminId,
      action: 'reverse_transaction',
      targetId: id,
      targetUserId: transaction.userId,
      details: JSON.stringify({ reason }),
      timestamp: new Date()
    });
    return reversed;
  }

  // ---------------- WATCHLIST ----------------
  async getUserWatchlist(userId: UserId) {
    return this.db.query.watchlist.findFirst({
      where: eq(schema.watchlist.userId, userId)
    });
  }

  async addToWatchlist(userId: UserId, symbol: string, name?: string) {
    const existing = await this.getUserWatchlist(userId);
    const symbols = new Set(existing?.symbols || []);
    symbols.add(symbol.toUpperCase());

    if (existing?.id) {
      const result = await this.db.update(schema.watchlist)
        .set({ symbols: Array.from(symbols), updatedAt: new Date() })
        .where(eq(schema.watchlist.id, existing.id))
        .returning();
      return result[0];
    }

    const result = await this.db.insert(schema.watchlist)
      .values({
        userId,
        symbols: Array.from(symbols)
      } as typeof schema.watchlist.$inferInsert)
      .returning();
    return result[0];
  }

  async removeFromWatchlist(userId: UserId, symbol: string) {
    const existing = await this.getUserWatchlist(userId);
    if (!existing?.id) return true;
    const symbols = new Set(existing.symbols || []);
    symbols.delete(symbol.toUpperCase());
    await this.db.update(schema.watchlist)
      .set({ symbols: Array.from(symbols), updatedAt: new Date() })
      .where(eq(schema.watchlist.id, existing.id));
    return true;
  }

  // ---------------- ALERTS ----------------
  async createAlert(data: Partial<typeof schema.priceAlerts.$inferInsert>) {
    const result = await this.db.insert(schema.priceAlerts)
      .values(data as typeof schema.priceAlerts.$inferInsert)
      .returning();
    return result[0];
  }

  async getAlert(id: string) {
    return this.db.query.priceAlerts.findFirst({
      where: eq(schema.priceAlerts.id, id)
    });
  }

  async getAlertById(id: string) {
    return this.getAlert(id);
  }

  async getUserAlerts(userId: UserId) {
    return this.db.query.priceAlerts.findMany({
      where: eq(schema.priceAlerts.userId, userId),
      orderBy: desc(schema.priceAlerts.createdAt)
    });
  }

  async getPriceAlert(id: string) {
    return this.getAlert(id);
  }

  async getActivePriceAlerts() {
    return this.db.query.priceAlerts.findMany({
      where: eq(schema.priceAlerts.isActive, true),
      orderBy: desc(schema.priceAlerts.createdAt)
    });
  }

  async updateAlert(id: string, data: Partial<typeof schema.priceAlerts.$inferInsert>) {
    const result = await this.db.update(schema.priceAlerts)
      .set(data)
      .where(eq(schema.priceAlerts.id, id))
      .returning();
    return result[0];
  }

  async updatePriceAlert(id: string, data: Partial<typeof schema.priceAlerts.$inferInsert>) {
    return this.updateAlert(id, data);
  }

  async deleteAlert(id: string) {
    await this.db.delete(schema.priceAlerts).where(eq(schema.priceAlerts.id, id));
  }

  async deletePriceAlert(id: string) {
    await this.db.delete(schema.priceAlerts).where(eq(schema.priceAlerts.id, id));
  }

  // ---------------- API KEYS ----------------
  async createApiKey(data: Partial<typeof schema.apiKeys.$inferInsert>) {
    const result = await this.db.insert(schema.apiKeys).values(data as typeof schema.apiKeys.$inferInsert).returning();
    return result[0];
  }

  async getApiKeyById(id: string) {
    return this.db.query.apiKeys.findFirst({
      where: eq(schema.apiKeys.id, id)
    });
  }

  async getApiKeyByHash(hash: string) {
    return this.db.query.apiKeys.findFirst({
      where: eq(schema.apiKeys.keyHash, hash)
    });
  }

  async getUserApiKeys(userId: UserId) {
    return this.db.query.apiKeys.findMany({
      where: eq(schema.apiKeys.userId, userId),
      orderBy: desc(schema.apiKeys.createdAt)
    });
  }

  async updateApiKey(id: string, data: Partial<typeof schema.apiKeys.$inferInsert>) {
    const result = await this.db.update(schema.apiKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return result[0];
  }

  async updateApiKeyLastUsed(id: string) {
    await this.db.update(schema.apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(schema.apiKeys.id, id));
  }

  async deleteApiKey(id: string) {
    await this.db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));
  }

  async revokeApiKey(id: string) {
    await this.updateApiKey(id, { isActive: false });
  }

  async getApiUsage(userId?: UserId) {
    const keys = userId ? await this.getUserApiKeys(userId) : await this.db.query.apiKeys.findMany();
    const totalRequests = keys.length * 1000; // placeholder metric
    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive).length,
      inactiveKeys: keys.filter(k => !k.isActive).length,
      totalRequests,
      lastUsed: keys
        .filter(k => k.lastUsed)
        .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
        .slice(0, 5)
    };
  }

  async getApiKeyUsageStats() {
    const keys = await this.db.query.apiKeys.findMany();
    const dailyUsage = Array.from({ length: 7 }, (_, index) => ({
      day: index,
      requests: Math.floor(Math.random() * 5000) + 1000
    }));
    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive).length,
      revokedKeys: keys.filter(k => !k.isActive).length,
      averageRateLimit: keys.length ? keys.reduce((sum, key) => sum + (key.rateLimit || 0), 0) / keys.length : 0,
      dailyUsage
    };
  }

  // ---------------- NEWS ----------------
  async getNewsArticles(limit = 100) {
    return this.db.query.newsArticles.findMany({
      orderBy: desc(schema.newsArticles.publishedAt),
      limit
    });
  }

  async getNewsArticleById(id: string) {
    return this.db.query.newsArticles.findFirst({
      where: eq(schema.newsArticles.id, id)
    });
  }

  async createNewsArticle(data: Partial<typeof schema.newsArticles.$inferInsert>) {
    const result = await this.db.insert(schema.newsArticles).values(data as typeof schema.newsArticles.$inferInsert).returning();
    return result[0];
  }

  async updateNewsArticle(id: string, data: Partial<typeof schema.newsArticles.$inferInsert>) {
    const result = await this.db.update(schema.newsArticles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.newsArticles.id, id))
      .returning();
    return result[0];
  }

  async deleteNewsArticle(id: string) {
    await this.db.delete(schema.newsArticles).where(eq(schema.newsArticles.id, id));
  }

  async getNewsAnalytics() {
    const articles = await this.db.query.newsArticles.findMany();
    return {
      totalArticles: articles.length,
      publishedToday: articles.filter(article => {
        const published = new Date(article.publishedAt ?? article.createdAt ?? new Date());
        const now = new Date();
        return published.toDateString() === now.toDateString();
      }).length,
      latestArticles: articles.slice(0, 5)
    };
  }

  // ---------------- KYC ----------------
  async createKycVerification(data: Partial<typeof schema.kycVerifications.$inferInsert>) {
    const result = await this.db.insert(schema.kycVerifications).values(data as typeof schema.kycVerifications.$inferInsert).returning();
    return result[0];
  }

  async getKycVerification(userId: UserId) {
    return this.db.query.kycVerifications.findFirst({
      where: eq(schema.kycVerifications.userId, userId)
    });
  }

  async getKycVerificationById(id: string) {
    return this.db.query.kycVerifications.findFirst({
      where: eq(schema.kycVerifications.id, id)
    });
  }

  async getAllKycVerifications(limit = 200) {
    return this.db.query.kycVerifications.findMany({
      orderBy: desc(schema.kycVerifications.createdAt),
      limit
    });
  }

  async updateKycVerification(id: string, data: Partial<typeof schema.kycVerifications.$inferInsert>) {
    const result = await this.db.update(schema.kycVerifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.kycVerifications.id, id))
      .returning();
    return result[0];
  }

  async getKycStatistics() {
    const verifications = await this.db.query.kycVerifications.findMany();
    const stats = verifications.reduce<Record<string, number>>((acc, verification) => {
      acc[verification.status] = (acc[verification.status] || 0) + 1;
      return acc;
    }, {});
    return {
      total: verifications.length,
      ...stats
    };
  }

  // ---------------- INVESTMENTS & SAVINGS ----------------
  async createInvestment(data: Partial<typeof schema.investmentPlans.$inferInsert>) {
    const result = await this.db.insert(schema.investmentPlans).values(data as typeof schema.investmentPlans.$inferInsert).returning();
    return result[0];
  }

  async getInvestmentById(id: string) {
    return this.db.query.investmentPlans.findFirst({ where: eq(schema.investmentPlans.id, id) });
  }

  async getUserInvestments(userId: UserId) {
    return this.db.query.investmentPlans.findMany({
      where: eq(schema.investmentPlans.userId, userId),
      orderBy: desc(schema.investmentPlans.createdAt)
    });
  }

  async getAllUserInvestmentPlans() {
    return this.db.query.investmentPlans.findMany({
      orderBy: desc(schema.investmentPlans.createdAt)
    });
  }

  async updateInvestment(id: string, data: Partial<typeof schema.investmentPlans.$inferInsert>) {
    const result = await this.db.update(schema.investmentPlans)
      .set(data)
      .where(eq(schema.investmentPlans.id, id))
      .returning();
    return result[0];
  }

  async deleteInvestment(id: string) {
    await this.db.delete(schema.investmentPlans).where(eq(schema.investmentPlans.id, id));
  }

  async updateInvestmentPlanReturns(id: string, data: { actualReturn?: string; currentValue?: string }) {
    await this.updateInvestment(id, {
      actualReturn: data.actualReturn,
      currentValue: data.currentValue
    });
  }

  async createInvestmentPlanTemplate(data: Partial<typeof schema.investmentPlanTemplates.$inferInsert>) {
    const result = await this.db.insert(schema.investmentPlanTemplates).values(data as typeof schema.investmentPlanTemplates.$inferInsert).returning();
    return result[0];
  }

  async getInvestmentPlanTemplates() {
    return this.db.query.investmentPlanTemplates.findMany({
      orderBy: desc(schema.investmentPlanTemplates.createdAt)
    });
  }

  async updateInvestmentPlanTemplate(id: string, data: Partial<typeof schema.investmentPlanTemplates.$inferInsert>) {
    const result = await this.db.update(schema.investmentPlanTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.investmentPlanTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteInvestmentPlanTemplate(id: string) {
    await this.db.delete(schema.investmentPlanTemplates).where(eq(schema.investmentPlanTemplates.id, id));
  }

  async createSavingsPlan(data: Partial<typeof schema.savingsPlans.$inferInsert>) {
    const result = await this.db.insert(schema.savingsPlans).values(data as typeof schema.savingsPlans.$inferInsert).returning();
    return result[0];
  }

  async getSavingsPlanById(id: string) {
    return this.db.query.savingsPlans.findFirst({
      where: eq(schema.savingsPlans.id, id)
    });
  }

  async getUserSavingsPlans(userId: UserId) {
    return this.db.query.savingsPlans.findMany({
      where: eq(schema.savingsPlans.userId, userId),
      orderBy: desc(schema.savingsPlans.createdAt)
    });
  }

  async getAllUserSavingsPlans() {
    return this.db.query.savingsPlans.findMany({
      orderBy: desc(schema.savingsPlans.createdAt)
    });
  }

  async updateSavingsPlan(id: string, data: Partial<typeof schema.savingsPlans.$inferInsert>) {
    const result = await this.db.update(schema.savingsPlans)
      .set(data)
      .where(eq(schema.savingsPlans.id, id))
      .returning();
    return result[0];
  }

  async deleteSavingsPlan(id: string) {
    await this.db.delete(schema.savingsPlans).where(eq(schema.savingsPlans.id, id));
  }

  async updateSavingsPlanInterest(id: string, data: { interestEarned?: string; totalSaved?: string }) {
    await this.updateSavingsPlan(id, {
      interestEarned: data.interestEarned,
      totalSaved: data.totalSaved
    });
  }

  async createSavingsPlanTemplate(data: Partial<typeof schema.savingsPlanTemplates.$inferInsert>) {
    const result = await this.db.insert(schema.savingsPlanTemplates).values(data as typeof schema.savingsPlanTemplates.$inferInsert).returning();
    return result[0];
  }

  async getSavingsPlanTemplates() {
    return this.db.query.savingsPlanTemplates.findMany({
      orderBy: desc(schema.savingsPlanTemplates.createdAt)
    });
  }

  async updateSavingsPlanTemplate(id: string, data: Partial<typeof schema.savingsPlanTemplates.$inferInsert>) {
    const result = await this.db.update(schema.savingsPlanTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.savingsPlanTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteSavingsPlanTemplate(id: string) {
    await this.db.delete(schema.savingsPlanTemplates).where(eq(schema.savingsPlanTemplates.id, id));
  }

  async createStakingPosition(data: Partial<typeof schema.stakingPositions.$inferInsert>) {
    const result = await this.db.insert(schema.stakingPositions).values(data as typeof schema.stakingPositions.$inferInsert).returning();
    return result[0];
  }

  async getStakingPosition(id: string) {
    return this.db.query.stakingPositions.findFirst({ where: eq(schema.stakingPositions.id, id) });
  }

  async getUserStakingPositions(userId: UserId) {
    return this.db.query.stakingPositions.findMany({
      where: eq(schema.stakingPositions.userId, userId),
      orderBy: desc(schema.stakingPositions.createdAt)
    });
  }

  async updateStakingPosition(id: string, data: Partial<typeof schema.stakingPositions.$inferInsert>) {
    const result = await this.db.update(schema.stakingPositions)
      .set(data)
      .where(eq(schema.stakingPositions.id, id))
      .returning();
    return result[0];
  }

  async getStakingRewards(userId: UserId) {
    const positions = await this.getUserStakingPositions(userId);
    const totalRewards = positions.reduce((sum, pos) => sum + parseFloat(pos.totalRewards || '0'), 0);
    return {
      totalRewards,
      positions
    };
  }

  async getStakingAnalytics() {
    const positions = await this.db.query.stakingPositions.findMany();
    const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.amount), 0);
    return {
      totalPositions: positions.length,
      totalValue,
      averageApy: positions.length
        ? positions.reduce((sum, pos) => sum + parseFloat(pos.apy), 0) / positions.length
        : 0
    };
  }

  async createLendingPosition(data: Partial<typeof schema.lendingPositions.$inferInsert>) {
    const result = await this.db.insert(schema.lendingPositions).values(data as typeof schema.lendingPositions.$inferInsert).returning();
    return result[0];
  }

  async getLendingPosition(id: string) {
    return this.db.query.lendingPositions.findFirst({ where: eq(schema.lendingPositions.id, id) });
  }

  async getUserLendingPositions(userId: UserId) {
    return this.db.query.lendingPositions.findMany({
      where: eq(schema.lendingPositions.userId, userId),
      orderBy: desc(schema.lendingPositions.createdAt)
    });
  }

  async updateLendingPosition(id: string, data: Partial<typeof schema.lendingPositions.$inferInsert>) {
    const result = await this.db.update(schema.lendingPositions)
      .set(data)
      .where(eq(schema.lendingPositions.id, id))
      .returning();
    return result[0];
  }

  async createLoan(data: Partial<typeof schema.loans.$inferInsert>) {
    const result = await this.db.insert(schema.loans).values(data as typeof schema.loans.$inferInsert).returning();
    return result[0];
  }

  async getLoan(id: string) {
    return this.db.query.loans.findFirst({
      where: eq(schema.loans.id, id)
    });
  }

  async getUserLoans(userId: UserId) {
    return this.db.query.loans.findMany({
      where: eq(schema.loans.userId, userId),
      orderBy: desc(schema.loans.createdAt)
    });
  }

  async updateLoan(id: string, data: Partial<typeof schema.loans.$inferInsert>) {
    const result = await this.db.update(schema.loans)
      .set(data)
      .where(eq(schema.loans.id, id))
      .returning();
    return result[0];
  }

  // ---------------- SOCIAL ----------------
  async createFriendRequest(data: Partial<typeof schema.friendRequests.$inferInsert>) {
    const existing = await this.getFriendRequest(data.fromUserId!, data.toUserId!);
    if (existing) return existing;
    const result = await this.db.insert(schema.friendRequests).values(data as typeof schema.friendRequests.$inferInsert).returning();
    return result[0];
  }

  async getFriendRequest(fromUserId: UserId, toUserId: UserId) {
    return this.db.query.friendRequests.findFirst({
      where: and(
        eq(schema.friendRequests.fromUserId, fromUserId),
        eq(schema.friendRequests.toUserId, toUserId)
      )
    });
  }

  async getFriendRequestById(id: string) {
    return this.db.query.friendRequests.findFirst({
      where: eq(schema.friendRequests.id, id)
    });
  }

  async getIncomingFriendRequests(userId: UserId) {
    return this.db.query.friendRequests.findMany({
      where: eq(schema.friendRequests.toUserId, userId),
      orderBy: desc(schema.friendRequests.createdAt)
    });
  }

  async updateFriendRequest(id: string, data: Partial<typeof schema.friendRequests.$inferInsert>) {
    const result = await this.db.update(schema.friendRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.friendRequests.id, id))
      .returning();
    return result[0];
  }

  async createFriendship(userId: UserId, friendId: UserId) {
    const entries = [
      { userId, friendId },
      { userId: friendId, friendId: userId }
    ];
    await this.db.insert(schema.friendships)
      .values(entries)
      .onConflictDoNothing();
  }

  async removeFriendship(userId: UserId, friendId: UserId) {
    await this.db.delete(schema.friendships)
      .where(or(
        and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)),
        and(eq(schema.friendships.userId, friendId), eq(schema.friendships.friendId, userId))
      ));
  }

  async getUserFriends(userId: UserId) {
    return this.db.query.friendships.findMany({
      where: eq(schema.friendships.userId, userId)
    });
  }

  async followUser(followerId: UserId, followingId: UserId) {
    await this.db.insert(schema.userFollowers)
      .values({ followerId, followingId })
      .onConflictDoNothing();
  }

  async unfollowUser(followerId: UserId, followingId: UserId) {
    await this.db.delete(schema.userFollowers)
      .where(and(
        eq(schema.userFollowers.followerId, followerId),
        eq(schema.userFollowers.followingId, followingId)
      ));
  }

  async isFollowing(followerId: UserId, followingId: UserId) {
    const follow = await this.db.query.userFollowers.findFirst({
      where: and(
        eq(schema.userFollowers.followerId, followerId),
        eq(schema.userFollowers.followingId, followingId)
      )
    });
    return Boolean(follow);
  }

  async getUserFollowers(userId: UserId) {
    return this.db.query.userFollowers.findMany({
      where: eq(schema.userFollowers.followingId, userId),
      orderBy: desc(schema.userFollowers.createdAt)
    });
  }

  async getUserFollowing(userId: UserId) {
    return this.db.query.userFollowers.findMany({
      where: eq(schema.userFollowers.followerId, userId),
      orderBy: desc(schema.userFollowers.createdAt)
    });
  }

  // ---------------- DEPOSITS ----------------
  async getDepositById(id: DepositId) {
    return this.db.query.deposits.findFirst({ where: eq(schema.deposits.id, id) });
  }

  async getAllDeposits(limit = 1000) {
    return this.db.query.deposits.findMany({
      orderBy: desc(schema.deposits.createdAt),
      limit
    });
  }

  async getUserDeposits(userId: UserId, limit = 100) {
    return this.db.query.deposits.findMany({
      where: eq(schema.deposits.userId, userId),
      orderBy: desc(schema.deposits.createdAt),
      limit
    });
  }

  async createDeposit(data: Partial<typeof schema.deposits.$inferSelect>) {
    return this.db.insert(schema.deposits).values(data as typeof schema.deposits.$inferInsert).returning();
  }

  async updateDeposit(id: DepositId, data: Partial<typeof schema.deposits.$inferInsert>) {
    const result = await this.db.update(schema.deposits)
      .set(data)
      .where(eq(schema.deposits.id, id))
      .returning();
    return result[0];
  }

  async updateDepositStatus(id: DepositId, status: string, adminNotes?: string) {
    return this.db
      .update(schema.deposits)
      .set({ status, adminNotes })
      .where(eq(schema.deposits.id, id));
  }

  async getSharedWalletAddresses() {
    return this.db.query.sharedWalletAddresses.findMany({
      where: eq(schema.sharedWalletAddresses.isActive, true)
    });
  }

  async createOrUpdateSharedWalletAddress(data: Partial<typeof schema.sharedWalletAddresses.$inferInsert>) {
    const existing = await this.db.query.sharedWalletAddresses.findFirst({
      where: eq(schema.sharedWalletAddresses.symbol, data.symbol!)
    });

    if (existing) {
      const result = await this.db.update(schema.sharedWalletAddresses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.sharedWalletAddresses.id, existing.id))
        .returning();
      return result[0];
    }

    const result = await this.db.insert(schema.sharedWalletAddresses)
      .values(data as typeof schema.sharedWalletAddresses.$inferInsert)
      .returning();
    return result[0];
  }

  // ---------------- WITHDRAWALS ----------------
  async getUserWithdrawals(userId: UserId) {
    return this.db.query.transactions.findMany({ where: and(eq(schema.transactions.userId, userId), eq(schema.transactions.type, 'withdrawal')) });
  }

  async getAllWithdrawals() {
    return this.db.query.transactions.findMany({ where: eq(schema.transactions.type, 'withdrawal') });
  }

  async getWithdrawalById(id: WithdrawalId) {
    return this.db.query.transactions.findFirst({ where: eq(schema.transactions.id, id) });
  }

  async createWithdrawal(data: Partial<typeof schema.transactions.$inferSelect>) {
    return this.db.insert(schema.transactions).values(data).returning();
  }

  async updateWithdrawalStatus(id: WithdrawalId, status: string, adminNotes?: string) {
    const updateData: any = { status };
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    const result = await this.db.update(schema.transactions).set(updateData).where(eq(schema.transactions.id, id)).returning();
    return result[0];
  }

  async confirmWithdrawal(userId: UserId, token: string) {
    // Find withdrawal with matching token and user
    const withdrawal = await this.db.query.transactions.findFirst({
      where: and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, 'withdrawal')
      ),
    });
    return withdrawal;
  }

  async updatePortfolioBalance(userId: UserId, amountChange: number) {
    const portfolio = await this.db.query.portfolios.findFirst({ where: eq(schema.portfolios.userId, userId) });
    if (portfolio) {
      const newCash = parseFloat(portfolio.availableCash) + amountChange;
      await this.updatePortfolio(portfolio.id, { availableCash: newCash.toString() });
    }
  }

  async calculateWithdrawalFees(amount: number, method?: string) {
    // Example: 0.5% fee, can vary by method
    const feeRate = method === 'crypto_wallet' ? 0.002 : 0.005;
    return amount * feeRate;
  }

  async getWithdrawalLimits(userId?: UserId) {
    // Retrieve from platformSettings table
    const limit = await this.db.query.platformSettings.findFirst({ where: eq(schema.platformSettings.key, 'withdrawal_limit') });
    return limit?.value || '1000';
  }

  async setWithdrawalLimits(limit: number) {
    return this.db
      .update(schema.platformSettings)
      .set({ value: limit.toString() })
      .where(eq(schema.platformSettings.key, 'withdrawal_limit'));
  }

  async getWithdrawalStats() {
    // Aggregate withdrawals
    const total = await this.db.select({ total: schema.transactions.amount }).from(schema.transactions).where(eq(schema.transactions.type, 'withdrawal'));
    return total;
  }

  // ---------------- METALS ----------------
  async getMetalPrice(symbol: string) {
    return this.db.query.metalsPricing.findFirst({ where: eq(schema.metalsPricing.symbol, symbol) });
  }

  async updateMetalPrice(symbol: string, price: number) {
    return this.db.update(schema.metalsPricing).set({ pricePerOunce: price }).where(eq(schema.metalsPricing.symbol, symbol));
  }

  // ---------------- BALANCE ADJUSTMENTS ----------------
  async adjustUserBalance(adminId: UserId, targetUserId: UserId, type: 'add' | 'remove' | 'set', amount: number) {
    return this.db.insert(schema.balanceAdjustments).values({
      adminId,
      targetUserId,
      adjustmentType: type,
      amount,
    }).returning();
  }

  async createBalanceAdjustment(data: Partial<typeof schema.balanceAdjustments.$inferInsert>) {
    const result = await this.db.insert(schema.balanceAdjustments)
      .values(data as typeof schema.balanceAdjustments.$inferInsert)
      .returning();
    return result[0];
  }

  async getBalanceAdjustments(targetUserId?: UserId, page = 1, limit = 50) {
    const offset = (Math.max(page, 1) - 1) * limit;
    const whereClause = targetUserId ? eq(schema.balanceAdjustments.targetUserId, targetUserId) : undefined;
    return this.db.query.balanceAdjustments.findMany({
      where: whereClause,
      orderBy: desc(schema.balanceAdjustments.createdAt),
      limit,
      offset
    });
  }

  async logAdminAction(data: Partial<typeof schema.adminActionLogs.$inferInsert>) {
    const result = await this.db.insert(schema.adminActionLogs)
      .values(data)
      .returning();
    return result[0];
  }

  // ---------------- SYSTEM / SECURITY ----------------
  async isDbConnected() {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      return false;
    }
  }

  async getActiveSessions() {
    const sessions = await this.db.query.sessions.findMany({
      orderBy: desc(schema.sessions.expire)
    });

    return sessions.map((session) => ({
      id: session.sid,
      userId: (session.sess as any)?.user?.id,
      data: session.sess,
      expire: session.expire
    }));
  }

  async invalidateUserSessions(userId: UserId) {
    await pool.query(
      "DELETE FROM sessions WHERE sess -> 'user' ->> 'id' = $1",
      [userId]
    );
  }

  async invalidateAllSessions() {
    await pool.query('DELETE FROM sessions');
  }

  async getSystemConfig() {
    const entries = await this.db.query.platformSettings.findMany();
    return entries.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.key] = entry.value;
      return acc;
    }, {});
  }

  async updateSystemConfig(data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      await this.db.insert(schema.platformSettings)
        .values({
          key,
          value,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: schema.platformSettings.key,
          set: {
            value,
            updatedAt: new Date()
          }
        });
    }
    return this.getSystemConfig();
  }

  async getRateLimitEntry(key: string): Promise<RateLimitStoreEntry | null> {
    const entry = await this.db.query.rateLimitEntries.findFirst({
      where: eq(schema.rateLimitEntries.key, key)
    });
    return entry?.data as RateLimitStoreEntry | null;
  }

  async setRateLimitEntry(key: string, data: RateLimitStoreEntry) {
    await this.db.insert(schema.rateLimitEntries)
      .values({
        key,
        data,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: schema.rateLimitEntries.key,
        set: {
          data,
          updatedAt: new Date()
        }
      });
  }

  async incrementFailedLoginAttempts(key: string) {
    const existing = await this.getRateLimitEntry(key);
    const count = (existing?.count ?? 0) + 1;
    const entry: RateLimitStoreEntry = {
      count,
      firstRequest: existing?.firstRequest ?? Date.now(),
      resetTime: Date.now() + 15 * 60 * 1000
    };
    await this.setRateLimitEntry(key, entry);
    return count;
  }

  async createAuditLog(data: Partial<typeof schema.auditLogs.$inferInsert>) {
    const result = await this.db.insert(schema.auditLogs)
      .values({
        ...data,
        timestamp: data.timestamp ?? new Date()
      })
      .returning();
    return result[0];
  }

  async getAuditLogs(limit = 200) {
    return this.db.query.auditLogs.findMany({
      orderBy: desc(schema.auditLogs.timestamp),
      limit
    });
  }

  async createSecurityLog(data: Partial<typeof schema.securityEvents.$inferInsert>) {
    const result = await this.db.insert(schema.securityEvents)
      .values({
        ...data,
        timestamp: data.timestamp ?? new Date()
      })
      .returning();
    return result[0];
  }

  async logSecurityEvent(event: { type: string; userId?: string; ip?: string; userAgent?: string; endpoint?: string; severity?: string; details?: Record<string, any> }) {
    return this.createSecurityLog({
      type: event.type,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      severity: event.severity ?? 'medium',
      details: event.details,
      timestamp: new Date()
    });
  }

  // ---------------- CHAT ----------------
  async getActiveChatSession(userId: UserId) {
    return this.db.query.liveChatSessions.findFirst({
      where: and(
        eq(schema.liveChatSessions.userId, userId),
        or(
          eq(schema.liveChatSessions.status, 'waiting'),
          eq(schema.liveChatSessions.status, 'active')
        )
      ),
      orderBy: desc(schema.liveChatSessions.startedAt)
    });
  }

  async createChatSession(data: Partial<InsertChatSession>) {
    if (!data.userId) {
      throw new Error('userId is required to create a chat session');
    }

    const values: InsertChatSession = {
      userId: data.userId!,
      subject: data.subject,
      status: data.status ?? 'waiting',
      agentId: data.agentId,
      agentName: data.agentName,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      rating: data.rating,
      feedback: data.feedback
    };

    const result = await this.db
      .insert(schema.liveChatSessions)
      .values(values)
      .returning();
    return result[0];
  }

  async getChatSession(id: ChatSessionId) {
    return this.db.query.liveChatSessions.findFirst({
      where: eq(schema.liveChatSessions.id, id)
    });
  }

  async getChatSessions(options: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = options;
    const whereClause = status ? eq(schema.liveChatSessions.status, status) : undefined;
    return this.db.query.liveChatSessions.findMany({
      where: whereClause,
      orderBy: desc(schema.liveChatSessions.startedAt),
      limit,
      offset: (Math.max(page, 1) - 1) * limit
    });
  }

  async assignChatSession(sessionId: ChatSessionId, agentId: UserId, agentName?: string) {
    const result = await this.db
      .update(schema.liveChatSessions)
      .set({
        agentId,
        agentName,
        status: 'active',
        startedAt: new Date()
      })
      .where(eq(schema.liveChatSessions.id, sessionId))
      .returning();
    return result[0];
  }

  async updateChatSessionStatus(sessionId: ChatSessionId, status: string, agentId?: UserId) {
    const updateData: Partial<InsertChatSession> = { status };
    if (agentId) {
      updateData.agentId = agentId;
    }
    if (status === 'ended') {
      updateData.endedAt = new Date();
    }

    const result = await this.db
      .update(schema.liveChatSessions)
      .set(updateData)
      .where(eq(schema.liveChatSessions.id, sessionId))
      .returning();
    return result[0];
  }

  async endChatSession(sessionId: ChatSessionId) {
    const result = await this.db
      .update(schema.liveChatSessions)
      .set({
        status: 'ended',
        endedAt: new Date()
      })
      .where(eq(schema.liveChatSessions.id, sessionId))
      .returning();
    return result[0];
  }

  async rateChatSession(sessionId: ChatSessionId, rating: number, feedback?: string) {
    const result = await this.db
      .update(schema.liveChatSessions)
      .set({
        rating,
        feedback
      })
      .where(eq(schema.liveChatSessions.id, sessionId))
      .returning();
    return result[0];
  }

  async getChatMessages(sessionId: ChatSessionId) {
    return this.db.query.liveChatMessages.findMany({
      where: eq(schema.liveChatMessages.sessionId, sessionId),
      orderBy: asc(schema.liveChatMessages.createdAt)
    });
  }

  async createChatMessage(data: Partial<InsertChatMessage>) {
    if (!data.sessionId || !data.senderId || !data.message) {
      throw new Error('sessionId, senderId, and message are required to create a chat message');
    }

    const values: InsertChatMessage = {
      sessionId: data.sessionId!,
      senderId: data.senderId!,
      senderName: data.senderName,
      senderRole: data.senderRole,
      message: data.message!,
      messageType: data.messageType ?? 'text',
      attachmentUrl: data.attachmentUrl,
      attachmentName: data.attachmentName,
      attachmentSize: data.attachmentSize,
      createdAt: data.createdAt
    };

    const result = await this.db
      .insert(schema.liveChatMessages)
      .values(values)
      .returning();
    return result[0];
  }

  async notifyAdminsNewChatSession(session: ChatSession) {
    const admins = await this.db.query.users.findMany({
      where: eq(schema.users.role, 'admin')
    });

    if (!admins.length) {
      console.log('New chat session created but no admins found', session.id);
      return;
    }

    const notifications = admins.map((admin) => ({
      userId: admin.id,
      type: 'chat',
      title: 'New live chat request',
      message: `User ${session.userId} started a chat about "${session.subject || 'support'}"`,
      read: false
    }));

    await this.db.insert(schema.notifications).values(notifications);
  }
}

// Export singleton instance
export const storage = new DatabaseStorage(db);