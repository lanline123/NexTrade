'use client';

import { useEffect, useState } from 'react';

const STEPS = ['软件许可协议', '系统环境检测', '创建数据', '安装结果'];

async function readJson(response: Response) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || json.message || `请求失败（${response.status}）`);
  }
  return json.data ?? json;
}

export default function InstallPage() {
  const [step, setStep] = useState(0);
  const [agreement, setAgreement] = useState('');
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    account: 'admin', password: '', sql: 'mysql', dbhost: '127.0.0.1', dbname: '', dbport: '3306',
    dbuser: '', dbpwd: '', redishost: '127.0.0.1', redisport: '6379', redispwd: '', redisselect: '0',
  });

  useEffect(() => {
    setLoading(true);
    fetch('/api/install/index?step=1')
      .then(readJson)
      .then((data) => setAgreement(typeof data === 'string' ? data : data?.agreement || data?.content || ''))
      .catch((reason) => setError(reason instanceof Error ? reason.message : '协议加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const next = async () => {
    setError('');
    if (step === 0) {
      setStep(1);
      setLoading(true);
      fetch('/api/install/index?step=2')
        .then(readJson)
        .then((data) => setChecks(Array.isArray(data) ? data : data?.list || []))
        .catch((reason) => setError(reason instanceof Error ? reason.message : '环境检测失败'))
        .finally(() => setLoading(false));
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setLoading(true);
      try {
        await readJson(await fetch('/api/install/index?step=3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, redisselect: Number(form.redisselect) }),
        }));
        setDone(true);
        setStep(3);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '安装失败');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <main className="install-page">
      <header className="install-header">
        <div className="install-brand">TigShop</div>
        <div className="install-steps">
          {STEPS.map((label, index) => (
            <div key={label} className={`install-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`}>
              <b>{index + 1}</b><span>{label}</span>
            </div>
          ))}
        </div>
      </header>

      <section className="install-body">
        {loading ? <div className="install-loading">加载中...</div> : null}
        {error ? <div className="install-error">{error}</div> : null}

        {step === 0 ? (
          <div className="install-agreement">
            <h1>软件许可协议</h1>
            <div dangerouslySetInnerHTML={{ __html: agreement || '请阅读并同意软件许可协议。' }} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="install-checks">
            <h1>系统环境检测</h1>
            {checks.length ? checks.map((item, index) => (
              <div className="install-check" key={index}>
                <span className={item.status === 1 || item.result === 1 ? 'is-ok' : 'is-fail'}>{item.status === 1 || item.result === 1 ? '✓' : '✗'}</span>
                <b>{item.name || item.title || '检测项'}</b>
                <span>{item.value || item.message || ''}</span>
              </div>
            )) : <div className="install-empty">暂无检测项</div>}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="install-form">
            <h1>创建数据</h1>
            <label>后台管理员账号</label><input value={form.account} onChange={(event) => update('account', event.target.value)} />
            <label>后台管理员密码</label><input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} />
            <label>数据库类型</label>
            <select value={form.sql} onChange={(event) => update('sql', event.target.value)}><option value="mysql">MySQL</option></select>
            <label>数据库地址</label><input value={form.dbhost} onChange={(event) => update('dbhost', event.target.value)} />
            <label>数据库名称</label><input value={form.dbname} onChange={(event) => update('dbname', event.target.value)} />
            <label>数据库端口</label><input value={form.dbport} onChange={(event) => update('dbport', event.target.value)} />
            <label>数据库用户名</label><input value={form.dbuser} onChange={(event) => update('dbuser', event.target.value)} />
            <label>数据库密码</label><input type="password" value={form.dbpwd} onChange={(event) => update('dbpwd', event.target.value)} />
            <label>Redis 地址</label><input value={form.redishost} onChange={(event) => update('redishost', event.target.value)} />
            <label>Redis 端口</label><input value={form.redisport} onChange={(event) => update('redisport', event.target.value)} />
            <label>Redis 密码</label><input type="password" value={form.redispwd} onChange={(event) => update('redispwd', event.target.value)} />
            <label>Redis Select 库</label><input value={form.redisselect} onChange={(event) => update('redisselect', event.target.value)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="install-success">
            <h1>安装完成</h1>
            <p>安装完成后建议删除 public/install 下的文件。</p>
            <div className="install-links">
              <a href="/">进入前台（PC 端）</a>
              <a href="/mobile/">进入前台（H5 端）</a>
              <a href="/admin/">进入后台</a>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="install-footer">
        {step > 0 ? <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>上一步</button> : null}
        {step < 3 ? <button type="button" className="is-primary" disabled={loading || (step === 2 && !done)} onClick={() => void next()}>{step === 2 ? '提交' : '下一步'}</button> : null}
      </footer>
    </main>
  );
}
