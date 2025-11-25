// backend/src/jobs/memory.queue.js
// In-memory queue adapter for BullMQ (when Redis is not available)

class MemoryJob {
  constructor(id, name, data, opts = {}) {
    this.id = id;
    this.name = name;
    this.data = data;
    this.opts = opts;
    this.attempts = 0;
    this.maxAttempts = opts.attempts || 3;
    this.status = 'waiting';
  }
}

class MemoryQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.handlers = [];
    this.processing = false;
  }

  async add(name, data, opts = {}) {
    const jobId = opts.jobId || `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job = new MemoryJob(jobId, name, data, opts);
    
    this.jobs.push(job);
    console.log(`📋 In-memory queue: добавлена задача ${jobId}`);
    
    // Process immediately
    setImmediate(() => this._processJob(job));
    
    return job;
  }

  async _processJob(job) {
    if (this.handlers.length === 0) {
      console.error(`❌ No handler for job ${job.id}`);
      return;
    }

    const handler = this.handlers[0];
    job.status = 'active';

    try {
      job.attempts++;
      console.log(`🔄 In-memory: выполнение задачи ${job.id} (попытка ${job.attempts})`);
      
      const result = await handler(job);
      
      job.status = 'completed';
      console.log(`✅ In-memory: задача ${job.id} завершена`);
      
      // Remove completed job
      if (job.opts.removeOnComplete) {
        this.jobs = this.jobs.filter(j => j.id !== job.id);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ In-memory: задача ${job.id} провалилась:`, error.message);
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        console.error(`❌ In-memory: задача ${job.id} исчерпала все попытки`);
        
        if (job.opts.removeOnFail) {
          this.jobs = this.jobs.filter(j => j.id !== job.id);
        }
      } else {
        // Retry with backoff
        const backoffDelay = job.opts.backoff?.delay || 5000;
        setTimeout(() => this._processJob(job), backoffDelay);
      }
      
      throw error;
    }
  }

  process(handler) {
    this.handlers.push(handler);
    console.log(`✅ In-memory: обработчик добавлен для очереди ${this.name}`);
  }
}

module.exports = MemoryQueue;