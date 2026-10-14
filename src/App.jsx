import { useEffect, useMemo, useState } from 'react'; import './App.css'; const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:8080/api'
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Education', 'Other']
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Investment', 'Other']

function localToday() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

const blankTransaction = () => ({
  type: 'EXPENSE',
  amount: '',
  category: 'Food',
  description: '',
  date: localToday(),
})

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Something went wrong. Please try again.')
  }
  return data
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function readableDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState(blankTransaction)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false))
  }, [])

  useEffect(() => {
    if (!user) {
      setTransactions([])
      return
    }
    api('/transactions')
      .then(setTransactions)
      .catch((error) => setNotice(error.message))
  }, [user])

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'INCOME')
      .reduce((sum, item) => sum + Number(item.amount), 0)
    const expenses = transactions
      .filter((item) => item.type === 'EXPENSE')
      .reduce((sum, item) => sum + Number(item.amount), 0)
    return { income, expenses, balance: income - expenses }
  }, [transactions])

  const expenseBreakdown = useMemo(() => {
    const grouped = transactions
      .filter((item) => item.type === 'EXPENSE')
      .reduce((groups, item) => {
        groups[item.category] = (groups[item.category] || 0) + Number(item.amount)
        return groups
      }, {})
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [transactions])

  async function refreshTransactions() {
    const items = await api('/transactions')
    setTransactions(items)
  }

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      const signedInUser = await api(`/auth/${authMode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      setUser(signedInUser)
      setAuthPassword('')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitTransaction(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const payload = { ...form, amount: Number(form.amount) }
    try {
      await api(editingId ? `/transactions/${editingId}` : '/transactions', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setForm(blankTransaction())
      setEditingId(null)
      await refreshTransactions()
      setNotice(editingId ? 'Transaction updated.' : 'Transaction added.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  function beginEdit(transaction) {
    setEditingId(transaction.id)
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date,
    })
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction?')) return
    setBusy(true)
    setNotice('')
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' })
      await refreshTransactions()
      setNotice('Transaction deleted.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Clear the local view even if the server is already unavailable.
    } finally {
      setUser(null)
      setNotice('')
      setForm(blankTransaction())
      setEditingId(null)
    }
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="loader" />Loading your workspace…</main>
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <a className="brand" href="#home" aria-label="MoneyMate home">
            <img src="/moneymate.svg" alt="" />
            <span>MoneyMate</span>
          </a>
          <div className="auth-copy">
            <p className="eyebrow">A calmer way to track money</p>
            <h1>{authMode === 'signup' ? 'Start with a clear picture.' : 'Welcome back.'}</h1>
            <p>Keep your income and spending organized in one simple place.</p>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              minLength={authMode === 'signup' ? 8 : undefined}
              maxLength={64}
              required
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
            />
            {notice && <p className="notice error" role="alert">{notice}</p>}
            <button className="primary-button full-button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-switch">
            {authMode === 'signup' ? 'Already have an account?' : 'New to MoneyMate?'}{' '}
            <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setNotice('') }}>
              {authMode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="privacy-note"><span aria-hidden="true">✦</span> Your account is private to you.</p>
        </section>
        <aside className="auth-art" aria-label="MoneyMate illustration">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-note note-back">₹</div>
          <div className="art-note note-front"><span>YOUR MONEY</span><strong>in good hands</strong><i>✦</i></div>
          <div className="art-caption"><span className="caption-dot" /> Small steps. Clear goals. Better habits.</div>
        </aside>
      </main>
    )
  }

  const categories = form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="MoneyMate home">
          <img src="/moneymate.svg" alt="" />
          <span>MoneyMate</span>
        </a>
        <div className="topbar-right">
          <span className="user-chip"><span className="avatar">{user.email[0].toUpperCase()}</span><span className="user-email">{user.email}</span></span>
          <button className="text-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">YOUR MONEY, IN ONE CLEAR PLACE</p>
            <h1>Good to see you, {user.email.split('@')[0]}.</h1>
            <p className="subheading">Here’s how things are looking today.</p>
          </div>
          <div className="today-pill"><span /> {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        </section>

        <section className="summary-grid" aria-label="Money summary">
          <article className="summary-card balance-card">
            <div className="summary-head"><span className="summary-icon">◎</span><span>Available balance</span></div>
            <strong>{money(totals.balance)}</strong>
            <small>Income minus expenses</small>
            <span className="balance-decoration" aria-hidden="true">₹</span>
          </article>
          <article className="summary-card">
            <div className="summary-head"><span className="summary-icon income-icon">↗</span><span>Total income</span></div>
            <strong>{money(totals.income)}</strong>
            <small>Money coming in</small>
          </article>
          <article className="summary-card">
            <div className="summary-head"><span className="summary-icon expense-icon">↘</span><span>Total expenses</span></div>
            <strong>{money(totals.expenses)}</strong>
            <small>Money going out</small>
          </article>
        </section>

        {notice && <p className={`notice dashboard-notice ${notice.includes('wrong') || notice.includes('required') ? 'error' : ''}`} role="status">{notice}</p>}

        <section className="work-grid">
          <article className="panel entry-panel">
            <div className="panel-title-row">
              <div><p className="eyebrow">KEEP IT UP TO DATE</p><h2>{editingId ? 'Edit transaction' : 'Add a transaction'}</h2></div>
              <span className="panel-sparkle" aria-hidden="true">✳</span>
            </div>
            <form className="entry-form" onSubmit={submitTransaction}>
              <div className="type-switch" role="group" aria-label="Transaction type">
                <button type="button" className={form.type === 'EXPENSE' ? 'active expense-active' : ''} onClick={() => setForm({ ...form, type: 'EXPENSE', category: 'Food' })}>Expense</button>
                <button type="button" className={form.type === 'INCOME' ? 'active income-active' : ''} onClick={() => setForm({ ...form, type: 'INCOME', category: 'Salary' })}>Income</button>
              </div>
              <label htmlFor="amount">Amount</label>
              <div className="amount-input"><span>₹</span><input id="amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></div>
              <div className="form-two-columns">
                <div><label htmlFor="category">Category</label><select id="category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
                <div><label htmlFor="date">Date</label><input id="date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
              </div>
              <label htmlFor="description">Note <span className="optional">(optional)</span></label>
              <input id="description" maxLength="200" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What was this for?" />
              <div className="form-actions">
                {editingId && <button className="secondary-button" type="button" onClick={() => { setEditingId(null); setForm(blankTransaction()) }}>Cancel</button>}
                <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add transaction'} <span aria-hidden="true">→</span></button>
              </div>
            </form>
          </article>

          <article className="panel activity-panel">
            <div className="panel-title-row activity-title">
              <div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent transactions</h2></div>
              <span className="count-badge">{transactions.length}</span>
            </div>
            {transactions.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">＋</div><strong>Your list starts here</strong><p>Add your first income or expense to see it here.</p></div>
            ) : (
              <div className="transaction-list">
                {transactions.map((item) => (
                  <div className="transaction-row" key={item.id}>
                    <div className={`transaction-symbol ${item.type === 'INCOME' ? 'symbol-income' : 'symbol-expense'}`}>{item.type === 'INCOME' ? '↗' : '↘'}</div>
                    <div className="transaction-main"><strong>{item.category}</strong><span>{item.description || item.type.toLowerCase()} · {readableDate(item.date)}</span></div>
                    <strong className={`transaction-amount ${item.type === 'INCOME' ? 'positive' : ''}`}>{item.type === 'INCOME' ? '+' : '−'}{money(item.amount)}</strong>
                    <div className="row-actions">
                      <button type="button" title="Edit transaction" aria-label={`Edit ${item.category}`} onClick={() => beginEdit(item)}>✎</button>
                      <button type="button" title="Delete transaction" aria-label={`Delete ${item.category}`} onClick={() => deleteTransaction(item.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel insights-panel">
          <div className="insights-heading"><div><p className="eyebrow">A LITTLE PERSPECTIVE</p><h2>Where your spending goes</h2></div><span className="insight-mark">↗</span></div>
          {expenseBreakdown.length === 0 ? <p className="insight-empty">Add an expense to see a simple category breakdown.</p> : (
            <div className="breakdown-list">
              {expenseBreakdown.map(([category, value], index) => {
                const share = totals.expenses ? Math.round((value / totals.expenses) * 100) : 0
                return <div className="breakdown-item" key={category}><div className="breakdown-label"><span className={`category-dot dot-${index + 1}`} />{category}<strong>{money(value)}</strong></div><div className="bar-track"><span className={`bar-fill fill-${index + 1}`} style={{ width: `${share}%` }} /></div></div>
              })}
            </div>
          )}
        </section>
        <footer className="page-footer"><span>MoneyMate</span><span>Small steps make a difference.</span></footer>
      </div>
    </main>
  )
}

export default App
