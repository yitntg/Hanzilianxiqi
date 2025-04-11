/**
 * 语音合成服务
 * 使用Azure Text-to-Speech服务将汉字转换为语音
 */
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

// Azure TTS配置
interface AzureTTSConfig {
  subscriptionKey: string;
  region: string;
  language: string;
  voice: string;
}

// 默认Azure语音配置(测试版使用)
const DEFAULT_CONFIG: AzureTTSConfig = {
  subscriptionKey: 'your-azure-key', // 实际应用中应从环境变量或安全存储获取
  region: 'eastasia',
  language: 'zh-CN',
  voice: 'zh-CN-XiaoxiaoNeural' // 标准女声
};

// 语音合成选项
export interface SpeechOptions {
  rate?: number;   // 语速(0.5-2.0)
  pitch?: number;  // 音调(0.5-2.0)
  volume?: number; // 音量(0-1.0)
  voice?: string;  // 语音名称
}

class SpeechService {
  private config: AzureTTSConfig;
  private audio: HTMLAudioElement | null = null;
  private isSpeaking: boolean = false;
  
  constructor(config: AzureTTSConfig = DEFAULT_CONFIG) {
    this.config = config;
  }
  
  /**
   * 使用Azure TTS API合成语音
   * 实际应用中，这应该通过后端API调用Azure服务，保护密钥
   */
  private async synthesizeSpeech(text: string, options: SpeechOptions = {}): Promise<ArrayBuffer | null> {
    // 检查是否有可用的密钥
    if (this.config.subscriptionKey === 'your-azure-key') {
      return null; // 如果没有真正的密钥，返回null以使用Web Speech API
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 创建语音配置
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
          this.config.subscriptionKey, 
          this.config.region
        );
        
        // 设置语音
        speechConfig.speechSynthesisVoiceName = options.voice || this.config.voice;
        
        // 设置输出格式为音频
        speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
        
        // 创建语音合成器
        const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
        
        // SSML支持更高级的控制
        const ssmlText = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${this.config.language}">
            <voice name="${options.voice || this.config.voice}">
              <prosody rate="${options.rate || 1}" pitch="${options.pitch || 0}%" volume="${options.volume || 1}">
                ${text}
              </prosody>
            </voice>
          </speak>
        `;
        
        // 开始语音合成
        synthesizer.speakSsmlAsync(
          ssmlText,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              // 获取音频数据
              const audioData = result.audioData;
              synthesizer.close();
              resolve(audioData);
            } else {
              synthesizer.close();
              reject(new Error(`语音合成失败: ${result.errorDetails}`));
            }
          },
          (error) => {
            synthesizer.close();
            reject(error);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 使用浏览器的Web Speech API作为备用方案
   */
  private speakWithWebSpeech(text: string, options: SpeechOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查浏览器是否支持语音合成
      if (!window.speechSynthesis) {
        reject(new Error('您的浏览器不支持语音合成'));
        return;
      }
      
      // 停止任何当前正在播放的语音
      this.stop();
      
      // 创建语音合成请求
      const utterance = new SpeechSynthesisUtterance(text);
      
      // 设置语言
      utterance.lang = this.config.language;
      
      // 设置语速、音调和音量
      if (options.rate) utterance.rate = options.rate;
      if (options.pitch) utterance.pitch = options.pitch;
      if (options.volume) utterance.volume = options.volume;
      
      // 选择语音
      if (options.voice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => 
          voice.name.includes(options.voice || '') && 
          voice.lang.includes(this.config.language)
        );
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      
      // 语音结束事件
      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };
      
      // 错误处理
      utterance.onerror = (event) => {
        this.isSpeaking = false;
        reject(new Error(`语音合成错误: ${event.error}`));
      };
      
      // 开始语音合成
      this.isSpeaking = true;
      window.speechSynthesis.speak(utterance);
    });
  }
  
  /**
   * 朗读文本
   */
  async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    try {
      // 先尝试使用Azure TTS API
      const audioData = await this.synthesizeSpeech(text, options);
      
      if (audioData) {
        // 如果有Azure TTS数据，使用AudioContext播放
        this.playAudioBuffer(audioData);
      } else {
        // 否则回退到Web Speech API
        await this.speakWithWebSpeech(text, options);
      }
    } catch (error) {
      console.error('语音合成失败:', error);
      // 出错时尝试使用Web Speech API
      try {
        await this.speakWithWebSpeech(text, options);
      } catch (webSpeechError) {
        console.error('Web Speech API也失败:', webSpeechError);
        throw error; // 保留原始错误
      }
    }
  }
  
  /**
   * 播放音频数据
   */
  private playAudioBuffer(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      // 创建Blob和URL
      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      // 创建音频元素
      if (!this.audio) {
        this.audio = new Audio();
      }
      
      // 设置事件处理器
      this.audio.onended = () => {
        this.isSpeaking = false;
        URL.revokeObjectURL(url);
        resolve();
      };
      
      this.audio.onerror = (event) => {
        this.isSpeaking = false;
        URL.revokeObjectURL(url);
        reject(new Error(`音频播放错误: ${event}`));
      };
      
      // 播放音频
      this.audio.src = url;
      this.isSpeaking = true;
      this.audio.play().catch(error => {
        this.isSpeaking = false;
        URL.revokeObjectURL(url);
        reject(error);
      });
    });
  }
  
  /**
   * 停止当前朗读
   */
  stop(): void {
    // 停止Azure TTS音频
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    
    // 停止Web Speech API
    if (window.speechSynthesis && this.isSpeaking) {
      window.speechSynthesis.cancel();
    }
    
    this.isSpeaking = false;
  }
  
  /**
   * 检查是否正在朗读
   */
  isPlaying(): boolean {
    return this.isSpeaking;
  }
  
  /**
   * 获取可用的语音列表
   */
  async getAvailableVoices(): Promise<string[]> {
    // 在实际应用中，这应该从Azure API获取可用的语音列表
    // 在这个演示中，我们使用Web Speech API
    
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve([]);
        return;
      }
      
      // 获取已经加载的语音
      let voices = window.speechSynthesis.getVoices();
      
      // 如果语音未加载，等待加载
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          const chineseVoices = voices
            .filter(voice => voice.lang.includes('zh'))
            .map(voice => voice.name);
          
          resolve(chineseVoices);
        };
      } else {
        // 过滤中文语音
        const chineseVoices = voices
          .filter(voice => voice.lang.includes('zh'))
          .map(voice => voice.name);
        
        resolve(chineseVoices);
      }
    });
  }
}

// 导出单例
export const speechService = new SpeechService();
export default speechService; 