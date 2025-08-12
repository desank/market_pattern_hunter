import nodemailer from 'nodemailer'
import { db } from '@/lib/db'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
}

export interface AlertData {
  type: 'vcp_found' | 'entry_signal'
  symbol: string
  stockName?: string
  vcpScore?: number
  currentPrice?: number
  entryPoints?: Array<{
    type: string
    price: number
    confidence: number
  }>
  scanName?: string
  etfSymbol?: string
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig | null = null

  constructor(config?: EmailConfig) {
    if (config) {
      this.initialize(config)
    }
  }

  /**
   * Initialize email service with configuration
   */
  initialize(config: EmailConfig) {
    this.config = config
    this.transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('Email service not initialized')
    }

    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email connection test failed:', error)
      return false
    }
  }

  /**
   * Send VCP pattern found alert
   */
  async sendVCPAlert(userId: string, alertData: AlertData): Promise<void> {
    const subject = `VCP Pattern Detected: ${alertData.symbol}`
    const html = this.generateVCPAlertHTML(alertData)
    const text = this.generateVCPAlertText(alertData)

    await this.sendEmail(userId, subject, html, text)
    
    // Log the alert in database
    await this.logAlert(userId, alertData, 'vcp_found')
  }

  /**
   * Send entry signal alert
   */
  async sendEntrySignalAlert(userId: string, alertData: AlertData): Promise<void> {
    const subject = `Entry Signal Alert: ${alertData.symbol}`
    const html = this.generateEntrySignalAlertHTML(alertData)
    const text = this.generateEntrySignalAlertText(alertData)

    await this.sendEmail(userId, subject, html, text)
    
    // Log the alert in database
    await this.logAlert(userId, alertData, 'entry_signal')
  }

  /**
   * Send email to user
   */
  private async sendEmail(userId: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not initialized')
    }

    try {
      // Get user email from database
      const user = await db.user.findUnique({
        where: { id: userId }
      })

      if (!user || !user.email) {
        throw new Error(`User email not found for user ID: ${userId}`)
      }

      const mailOptions = {
        from: this.config!.from,
        to: user.email,
        subject,
        html,
        text
      }

      await this.transporter.sendMail(mailOptions)
      console.log(`Email sent to ${user.email}: ${subject}`)
    } catch (error) {
      console.error('Failed to send email:', error)
      throw error
    }
  }

  /**
   * Generate HTML for VCP alert
   */
  private generateVCPAlertHTML(data: AlertData): string {
    const confidenceColor = data.vcpScore && data.vcpScore >= 80 ? '#22c55e' : 
                           data.vcpScore && data.vcpScore >= 60 ? '#f59e0b' : '#ef4444'
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">VCP Pattern Detected</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Stock Market Scanner Alert</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="margin: 0; font-size: 28px; color: #1f2937;">${data.symbol}</h2>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${data.stockName || ''}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 24px; font-weight: bold; color: ${confidenceColor};">
                ${data.vcpScore || 0}%
              </div>
              <div style="font-size: 12px; color: #6b7280;">Confidence Score</div>
            </div>
          </div>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #374151;">Pattern Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <strong>Current Price:</strong> $${data.currentPrice?.toFixed(2) || 'N/A'}
              </div>
              <div>
                <strong>Scan:</strong> ${data.scanName || 'N/A'}
              </div>
              <div>
                <strong>ETF:</strong> ${data.etfSymbol || 'N/A'}
              </div>
              <div>
                <strong>Pattern Type:</strong> Volatility Contraction
              </div>
            </div>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 5px 0; color: #92400e;">What this means:</h4>
            <p style="margin: 0; color: #78350f;">
              A Volatility Contraction Pattern (VCP) has been detected in ${data.symbol}. 
              This pattern suggests the stock is consolidating after an uptrend and may be 
              preparing for a potential breakout. Monitor for entry signals.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated alert from your Stock Market Scanner.</p>
            <p>Please monitor the stock closely and conduct your own research before making any trading decisions.</p>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Generate text for VCP alert
   */
  private generateVCPAlertText(data: AlertData): string {
    return `
VCP PATTERN DETECTED

Symbol: ${data.symbol}
Name: ${data.stockName || ''}
Confidence Score: ${data.vcpScore || 0}%
Current Price: $${data.currentPrice?.toFixed(2) || 'N/A'}
Scan: ${data.scanName || 'N/A'}
ETF: ${data.etfSymbol || 'N/A'}

A Volatility Contraction Pattern (VCP) has been detected. This pattern suggests the stock is consolidating after an uptrend and may be preparing for a potential breakout. Monitor for entry signals.

Please monitor the stock closely and conduct your own research before making any trading decisions.
    `.trim()
  }

  /**
   * Generate HTML for entry signal alert
   */
  private generateEntrySignalAlertHTML(data: AlertData): string {
    const entryPointsHTML = data.entryPoints?.map(point => `
      <div style="background: #f0f9ff; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${point.type.charAt(0).toUpperCase() + point.type.slice(1)} Entry</strong>
          <span style="background: ${point.confidence >= 70 ? '#22c55e' : '#f59e0b'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${point.confidence}%
          </span>
        </div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">
          Target Price: $${point.price.toFixed(2)}
        </div>
      </div>
    `).join('') || ''

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Entry Signal Alert</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Stock Market Scanner Alert</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="margin: 0; font-size: 28px; color: #1f2937;">${data.symbol}</h2>
              <p style="margin: 5px 0 0 0; color: #6b7280;">${data.stockName || ''}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 24px; font-weight: bold; color: #ef4444;">
                READY
              </div>
              <div style="font-size: 12px; color: #6b7280;">For Entry</div>
            </div>
          </div>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #374151;">Current Status</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <strong>Current Price:</strong> $${data.currentPrice?.toFixed(2) || 'N/A'}
              </div>
              <div>
                <strong>VCP Score:</strong> ${data.vcpScore || 0}%
              </div>
              <div>
                <strong>Scan:</strong> ${data.scanName || 'N/A'}
              </div>
              <div>
                <strong>ETF:</strong> ${data.etfSymbol || 'N/A'}
              </div>
            </div>
          </div>
          
          ${entryPointsHTML ? `
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">Suggested Entry Points</h3>
              ${entryPointsHTML}
            </div>
          ` : ''}
          
          <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 5px 0; color: #991b1b;">Action Required:</h4>
            <p style="margin: 0; color: #7f1d1d;">
              Entry signals have been detected for ${data.symbol}. The stock shows favorable conditions 
              for entering a trade based on VCP pattern analysis. Review the suggested entry points and 
              consider your risk tolerance before proceeding.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Entry Details
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated alert from your Stock Market Scanner.</p>
            <p>Please conduct thorough analysis and consider your risk tolerance before making any trading decisions.</p>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Generate text for entry signal alert
   */
  private generateEntrySignalAlertText(data: AlertData): string {
    const entryPointsText = data.entryPoints?.map(point => 
      `${point.type.charAt(0).toUpperCase() + point.type.slice(1)} Entry: $${point.price.toFixed(2)} (${point.confidence}% confidence)`
    ).join('\n') || ''

    return `
ENTRY SIGNAL ALERT

Symbol: ${data.symbol}
Name: ${data.stockName || ''}
Current Price: $${data.currentPrice?.toFixed(2) || 'N/A'}
VCP Score: ${data.vcpScore || 0}%
Scan: ${data.scanName || 'N/A'}
ETF: ${data.etfSymbol || 'N/A'}

${entryPointsText ? `SUGGESTED ENTRY POINTS:\n${entryPointsText}\n` : ''}

Entry signals have been detected. The stock shows favorable conditions for entering a trade based on VCP pattern analysis. Review the suggested entry points and consider your risk tolerance before proceeding.

Please conduct thorough analysis and consider your risk tolerance before making any trading decisions.
    `.trim()
  }

  /**
   * Log alert in database
   */
  private async logAlert(userId: string, data: AlertData, type: string): Promise<void> {
    try {
      const message = type === 'vcp_found' 
        ? `VCP pattern detected in ${data.symbol} with ${data.vcpScore || 0}% confidence`
        : `Entry signal detected for ${data.symbol} at $${data.currentPrice?.toFixed(2) || 'N/A'}`

      await db.alert.create({
        data: {
          userId,
          type,
          symbol: data.symbol,
          message,
          sent: true,
          sentAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log alert:', error)
    }
  }
}

// Create default instance (will need to be initialized with config)
export const emailService = new EmailService()