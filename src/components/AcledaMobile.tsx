import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  QrCode, 
  ScanLine, 
  ArrowLeftRight, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  HandCoins, 
  Zap, 
  Droplet, 
  BookOpen, 
  Heart, 
  MessageSquare, 
  Menu, 
  ArrowLeft, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Copy, 
  Plus, 
  Download, 
  Share2, 
  Phone, 
  Check, 
  X, 
  ShieldCheck, 
  DollarSign, 
  RefreshCw,
  Home,
  Utensils,
  ShoppingBag,
  Info
} from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  currency: 'USD' | 'KHR';
  date: string;
  description: string;
  logoType: 'phone' | 'transfer' | 'utility' | 'deposit';
}

export default function AcledaMobile() {
  const [activeSubScreen, setActiveSubScreen] = useState<'home' | 'topup' | 'transfer' | 'accounts' | 'qr_scan' | 'receipt' | 'pay_bills' | 'my_qr'>('home');
  const [lang, setLang] = useState<'kh' | 'en'>('kh');
  const [showBalance, setShowBalance] = useState<boolean>(false);
  const [balanceUSD, setBalanceUSD] = useState<number>(450.25);
  const [balanceKHR, setBalanceKHR] = useState<number>(1800000);
  
  // Simulated MPIN state
  const [showMpinModal, setShowMpinModal] = useState<boolean>(false);
  const [mpinInput, setMpinInput] = useState<string>('');
  const [onMpinSuccess, setOnMpinSuccess] = useState<(() => void) | null>(null);

  // Form states for Mobile top-up
  const [topupPhone, setTopupPhone] = useState<string>('');
  const [topupAmount, setTopupAmount] = useState<number>(5);
  const [telecomCompany, setTelecomCompany] = useState<'smart' | 'cellcard' | 'metfone'>('smart');

  // Form states for Transfer
  const [transferRecipient, setTransferRecipient] = useState<string>('');
  const [transferAccountNum, setTransferAccountNum] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferCurrency, setTransferCurrency] = useState<'USD' | 'KHR'>('USD');
  const [transferRemark, setTransferRemark] = useState<string>('');

  // Form states for Pay Bills
  const [billType, setBillType] = useState<'electric' | 'water' | 'school'>('school');
  const [billAmount, setBillAmount] = useState<number>(25);
  const [billAccountNo, setBillAccountNo] = useState<string>('SCH-CHBAR-048');

  // State to simulate QR Camerawork
  const [scannedMerchantName, setScannedMerchantName] = useState<string>('');
  const [scannedMerchantAmount, setScannedMerchantAmount] = useState<number>(0);

  // Success receipts state
  const [receiptDetails, setReceiptDetails] = useState<{
    txnId: string;
    title: string;
    amount: string;
    currency: string;
    receiver: string;
    date: string;
    type: string;
    fee: string;
  } | null>(null);

  // Dynamic state list of simulated transactions
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'TXN3049182',
      type: lang === 'kh' ? 'ផ្ទេរប្រាក់ចូល' : 'Incoming Transfer',
      amount: '350.00',
      currency: 'USD',
      date: '01-06-2026',
      description: 'ប្រាក់ខែគ្រូបង្រៀនប្រចាំខែ (School Fund)',
      logoType: 'deposit'
    },
    {
      id: 'TXN3049111',
      type: lang === 'kh' ? 'បញ្ចូលលុយទូរស័ព្ទ' : 'Phone Top-up',
      amount: '5.00',
      currency: 'USD',
      date: '31-05-2026',
      description: 'Smart Axiata: 096455212',
      logoType: 'phone'
    },
    {
      id: 'TXN3048992',
      type: lang === 'kh' ? 'បង់ថ្លៃទឹកស្អាត' : 'Water Bill Utility',
      amount: '12,000',
      currency: 'KHR',
      date: '28-05-2026',
      description: 'PPWSA - លេខអតិថិជន: W-930492',
      logoType: 'utility'
    }
  ]);

  // Translate labels helper
  const t = {
    kh: {
      appName: 'អេស៊ីលីដា',
      bankName: 'ACLEDA BANK',
      pay: 'បង់ប្រាក់',
      phoneTopup: 'បញ្ចូលលុយទូរស័ព្ទ',
      transfer: 'ផ្ទេរប្រាក់',
      cards: 'ប័ណ្ណ',
      qrPay: 'ទូទាត់តាម QR',
      accounts: 'គណនី',
      deposits: 'ប្រាក់បញ្ញើ',
      loans: 'ប្រាក់កម្ចី',
      quickCash: 'ដកប្រាក់រហ័ស',
      activeStatus: 'សកម្មភាពចុងក្រោយ',
      lastAction: 'ដំណើរការធម្មតា',
      myPoints: 'ពិន្ទុរបស់ខ្ញុំ',
      pointsDesc: 'ទទួលបានពិន្ទុបន្ថែមពីការធ្វើប្រតិបត្តិការ ហើយប្តូរពិន្ទុទាំងនោះទៅជារង្វាន់ធំៗជាច្រើនប្រចាំខែ',
      toanchetPay: 'ទាន់ចិត្តផេ',
      toanchetdesc: 'ដោយងាយស្រួលគ្រប់គ្រងរាល់ប្រតិបត្តិការអាជីវកម្ម និងការចំណាយធនធានប្រចាំថ្ងៃរបស់អ្នក',
      publicServices: 'សេវាសាធារណៈ',
      otherServices: 'សេវាផ្សេងៗ',
      home: 'ទំព័រដើម',
      records: 'កំណត់ត្រា',
      chat: 'សន្ទនា',
      menu: 'ម៉ឺនុយ',
      back: 'ត្រឡប់ក្រោយ',
      confirm: 'បញ្ជាក់',
      walletBal: 'សមតុល្យទឹកប្រាក់',
      phoneNum: 'លេខទូរស័ព្ទ',
      amount: 'ចំនួនទឹកប្រាក់',
      remarks: 'ចំណាំ/ហេតុផល',
      recipientNum: 'លេខគណនីអ្នកទទួល',
      nameOfRecipient: 'ឈ្មោះអ្នកទទួល',
      success: 'ប្រតិបត្តិការជោគជ័យ!',
      txnId: 'លេខកូដប្រតិបត្តិការ',
      fee: 'កម្រៃសេវា',
      feeFree: 'ឥតគិតថ្លៃ ($0.00)',
      time: 'ពេលវេលា',
      payNow: 'ទូទាត់ឥឡូវនេះ',
      enterPin: 'សូមបញ្ចូលលេខកូដសម្ងាត់ MPIN ៦ខ្ទង់ ដើម្បីផ្ទៀងផ្ទាត់',
      incorrectPin: 'លេខកូដ MPIN មិនត្រឹមត្រូវទេ! សូមព្យាយាមម្តងទៀត',
      simPanel: 'ផ្ទាំងគ្រប់គ្រងការពិសោធន៍ទូរស័ព្ទ (Simulator Control Panel)',
      simDesc: 'អ្នកអាចផ្លាស់ប្តូរសមតុល្យគណនី ឬពិនិត្យមើលប្រតិបត្តិការជាក់ស្តែងនៅទីនេះ។',
      refillUSD: 'បន្ថែមលុយ $100 USD ចូលគណនី',
      refillKHR: 'បន្ថែមលុយ ៥០០,០០០ KHR',
      cleanLogs: 'សម្អាតបញ្ជីប្រវត្តិប្រតិបត្តិការ',
      waterUtility: 'រដ្ឋាករទឹករាជធានីភ្នំពេញ (PPWSA)',
      electricityUtility: 'អគ្គិសនីកម្ពុជា (EDC)',
      schoolUtility: 'វិភាគទាន/ថ្លៃសិក្សា - សាលាសហគមន៍ច្បារច្រុះ',
      billPayment: 'បង់ថ្លៃសេវាប្រើប្រាស់',
      scanNotice: 'សូមប្រើទូរស័ព្ទរបស់អ្នកស្កែន QR កូដខាងក្រោម ឬចុចលើ QR Merchant គំរូដើម្បីទូទាត់ប្រាក់',
      myQrTitle: 'QR ទទួលប្រាក់ផ្ទាល់ខ្លួនរបស់ខ្ញុំ',
      qrHint: 'អ្នកដទៃអាចស្កែនរូបខាងក្រោម ដើម្បីផ្ទេរប្រាក់មកគណនីរបស់អ្នកបានភ្លាមៗ',
    },
    en: {
      appName: 'ACLEDA Mobile',
      bankName: 'ACLEDA BANK',
      pay: 'Payments',
      phoneTopup: 'Phone Top-up',
      transfer: 'Transfers',
      cards: 'My Cards',
      qrPay: 'QR Payments',
      accounts: 'My Accounts',
      deposits: 'Deposits',
      loans: 'Loans',
      quickCash: 'Quick Cash',
      activeStatus: 'Last Active State',
      lastAction: 'Normal operation',
      myPoints: 'My Loyalty Points',
      pointsDesc: 'Earn multiple loyalty points with every digital transaction and redeem major prizes monthly.',
      toanchetPay: 'ToanChet Pay',
      toanchetdesc: 'Manage your retail shop expenses and standard business transactions effortlessly.',
      publicServices: 'Public Services',
      otherServices: 'Other Services',
      home: 'Home',
      records: 'Records',
      chat: 'Chat Hub',
      menu: 'Main Menu',
      back: 'Go Back',
      confirm: 'Confirm Payment',
      walletBal: 'Available Balance',
      phoneNum: 'Phone Number',
      amount: 'Transaction Amount',
      remarks: 'Optional Remark',
      recipientNum: 'Receiver Account No.',
      nameOfRecipient: 'Receiver Full Name',
      success: 'Transaction Successful!',
      txnId: 'Transaction Reference ID',
      fee: 'Processing Fee',
      feeFree: 'Free of Charge ($0.00)',
      time: 'Timestamp',
      payNow: 'Pay Now',
      enterPin: 'Please enter your 6-digit secure MPIN code to verify',
      incorrectPin: 'Passcode MPIN incorrect! Please try again.',
      simPanel: 'Mobile Simulation Control Panel',
      simDesc: 'Adjust account balances or look over the live transaction streams here.',
      refillUSD: 'Refill Account +$100 USD',
      refillKHR: 'Refill Account +500,000 KHR',
      cleanLogs: 'Reset Transaction Logs',
      waterUtility: 'Phnom Penh Water Supply (PPWSA)',
      electricityUtility: 'Electricite du Cambodge (EDC)',
      schoolUtility: 'Chbar Chroh School Contribution/Tution',
      billPayment: 'Utility Bill Payment',
      scanNotice: 'Point scanner at any QR or click simulated merchants below to dry-run',
      myQrTitle: 'My Individual KHQR',
      qrHint: 'Anyone can scan this secure KHQR code to transfer money to your account instantly.',
    }
  }[lang];

  // Helper formats
  const formatAmount = (num: number, currency: 'USD' | 'KHR') => {
    if (currency === 'USD') {
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      return num.toLocaleString('en-US') + ' KHR';
    }
  };

  // MPIN Trigger handler
  const triggerMpinConfirmation = (onSuccess: () => void) => {
    setMpinInput('');
    setOnMpinSuccess(() => onSuccess);
    setShowMpinModal(true);
  };

  const handleMpinKeyPress = (num: string) => {
    if (mpinInput.length < 6) {
      const newPin = mpinInput + num;
      setMpinInput(newPin);
      
      if (newPin.length === 6) {
        // Automatically check
        if (newPin === '123456' || newPin === '112233' || true) { // Permit any correct looking inputs for smooth demo
          setTimeout(() => {
            setShowMpinModal(false);
            if (onMpinSuccess) {
              onMpinSuccess();
            }
          }, 350);
        }
      }
    }
  };

  const handleMpinBackspace = () => {
    setMpinInput(prev => prev.slice(0, -1));
  };

  // Top Up Confirmation
  const executeTopup = () => {
    if (!topupPhone || topupPhone.trim().length < 8) {
      alert(lang === 'kh' ? 'សូមបញ្ជាក់លេខទូរស័ព្ទឲ្យត្រឹមត្រូវ' : 'Please input a valid phone number');
      return;
    }
    
    if (balanceUSD < topupAmount) {
      alert(lang === 'kh' ? 'ទឹកប្រាក់ក្នុងគណនីរបស់អ្នកមិនគ្រប់គ្រាន់ទេ' : 'Insufficient balance inside USD account');
      return;
    }

    triggerMpinConfirmation(() => {
      // Deduct balance
      setBalanceUSD(prev => prev - topupAmount);
      
      // Log TXN
      const randId = 'TXN' + Math.floor(1000000 + Math.random() * 9000000);
      const companyLabel = telecomCompany.toUpperCase();
      const newTxn: Transaction = {
        id: randId,
        type: lang === 'kh' ? 'បញ្ចូលលុយទូរស័ព្ទ' : 'Phone Top-up',
        amount: topupAmount.toFixed(2),
        currency: 'USD',
        date: new Date().toLocaleDateString('kh-KH'),
        description: `${companyLabel} Top-up: ${topupPhone}`,
        logoType: 'phone'
      };

      setTransactions(prev => [newTxn, ...prev]);

      // Set Receipt Info
      setReceiptDetails({
        txnId: randId,
        title: lang === 'kh' ? 'បញ្ចូលលុយទូរស័ព្ទជោគជ័យ' : 'Phone Top-up Successful',
        amount: topupAmount.toFixed(2),
        currency: 'USD',
        receiver: `${companyLabel} Number: ${topupPhone}`,
        date: new Date().toLocaleString(),
        type: 'PHONE_TOPUP',
        fee: '$0.00'
      });

      setActiveSubScreen('receipt');
    });
  };

  // Transfer Confirmation
  const executeTransfer = () => {
    if (!transferRecipient.trim()) {
      alert(lang === 'kh' ? 'សូមបញ្ចូលឈ្មោះអ្នកទទួលផល' : 'Please input recipient full name');
      return;
    }
    if (!transferAccountNum.trim()) {
      alert(lang === 'kh' ? 'សូមបញ្ចូលលេខគណនីអ្នកទទួលផល' : 'Please input recipient account number');
      return;
    }
    if (transferAmount <= 0) {
      alert(lang === 'kh' ? 'ទឹកប្រាក់ផ្ទេរត្រូវតែធំជាងសូន្យ' : 'Transfer amount must be greater than zero');
      return;
    }

    if (transferCurrency === 'USD') {
      if (balanceUSD < transferAmount) {
        alert(lang === 'kh' ? 'គណនីដុល្លារគ្មានទឹកប្រាក់គ្រប់គ្រាន់សម្រាប់ការផ្ទេរនេះទេ' : 'Your USD balance is insufficient');
        return;
      }
    } else {
      if (balanceKHR < transferAmount) {
        alert(lang === 'kh' ? 'គណនីរៀលគ្មានទឹកប្រាក់គ្រប់គ្រាន់សម្រាប់ការផ្ទេរនេះទេ' : 'Your KHR balance is insufficient');
        return;
      }
    }

    triggerMpinConfirmation(() => {
      // Deduct
      if (transferCurrency === 'USD') {
        setBalanceUSD(prev => prev - transferAmount);
      } else {
        setBalanceKHR(prev => prev - transferAmount);
      }

      const randId = 'TXN' + Math.floor(1000000 + Math.random() * 9000000);
      const newTxn: Transaction = {
        id: randId,
        type: lang === 'kh' ? 'ផ្ទេរប្រាក់ចេញ' : 'Fund Transfer Out',
        amount: transferCurrency === 'USD' ? transferAmount.toFixed(2) : transferAmount.toLocaleString(),
        currency: transferCurrency,
        date: new Date().toLocaleDateString('kh-KH'),
        description: `ផ្ទេរទៅ៖ ${transferRecipient} (${transferAccountNum})`,
        logoType: 'transfer'
      };

      setTransactions(prev => [newTxn, ...prev]);

      setReceiptDetails({
        txnId: randId,
        title: lang === 'kh' ? 'ផ្ទេរប្រាក់ប្រកបដោយសុវត្ថិភាព' : 'Secure Electronic Transfer',
        amount: transferCurrency === 'USD' ? transferAmount.toFixed(2) : transferAmount.toLocaleString(),
        currency: transferCurrency,
        receiver: `${transferRecipient} (${transferAccountNum})`,
        date: new Date().toLocaleString(),
        type: 'TRANSFER',
        fee: 'Free of charge'
      });

      setActiveSubScreen('receipt');
    });
  };

  // Pay Utility Bills
  const executeBillPayment = () => {
    if (billAmount <= 0) {
      alert('Amount must be positive');
      return;
    }

    if (balanceUSD < billAmount) {
      alert(lang === 'kh' ? 'ទឹកប្រាក់គណនីដុល្លាររបស់អ្នកមិនគ្រប់គ្រាន់ទេ' : 'Insufficient USD balance');
      return;
    }

    triggerMpinConfirmation(() => {
      setBalanceUSD(prev => prev - billAmount);

      const randId = 'TXN' + Math.floor(1000000 + Math.random() * 9000000);
      const billLabel = billType === 'school' 
        ? (lang === 'kh' ? 'វិភាគទានសាលាច្បារច្រុះ' : 'Chbar Chroh School Fee')
        : billType === 'electric' ? 'EDC Electricity' : 'PPWSA Water Supply';

      const newTxn: Transaction = {
        id: randId,
        type: lang === 'kh' ? 'បង់ថ្លៃសេវាប្រើប្រាស់' : 'Utility Payment',
        amount: billAmount.toFixed(2),
        currency: 'USD',
        date: new Date().toLocaleDateString('kh-KH'),
        description: `${billLabel} (${billAccountNo})`,
        logoType: 'utility'
      };

      setTransactions(prev => [newTxn, ...prev]);

      setReceiptDetails({
        txnId: randId,
        title: lang === 'kh' ? 'បង់វិក្កយបត្រជោគជ័យ' : 'Bill Payment Completed',
        amount: billAmount.toFixed(2),
        currency: 'USD',
        receiver: `${billLabel} [No: ${billAccountNo}]`,
        date: new Date().toLocaleString(),
        type: 'UTILITY_BILL',
        fee: '$0.00'
      });

      setActiveSubScreen('receipt');
    });
  };

  // Simulate Scanning a shop QR Code
  const handlePredefinedQRScan = (merchant: string, price: number) => {
    setScannedMerchantName(merchant);
    setScannedMerchantAmount(price);
    
    // Auto pay flow after scanning visual
    setTimeout(() => {
      if (balanceUSD < price) {
        alert(lang === 'kh' ? 'សមតុល្យលុយដុល្លារមិនគ្រប់គ្រាន់ទេ' : 'Insufficient USD Funds to pay from QR');
        return;
      }

      triggerMpinConfirmation(() => {
        setBalanceUSD(prev => prev - price);

        const randId = 'TXN' + Math.floor(1000000 + Math.random() * 9000000);
        const newTxn: Transaction = {
          id: randId,
          type: lang === 'kh' ? 'ទូទាត់តាម KHQR' : 'KHQR Merchant Pay',
          amount: price.toFixed(2),
          currency: 'USD',
          date: new Date().toLocaleDateString('kh-KH'),
          description: `ទូទាត់ទំនិញនៅហាង៖ ${merchant}`,
          logoType: 'utility'
        };

        setTransactions(prev => [newTxn, ...prev]);

        setReceiptDetails({
          txnId: randId,
          title: lang === 'kh' ? 'ទូទាត់ KHQR រហ័ស និងសុវត្ថិភាព' : 'Secure KHQR EasyPay Complete',
          amount: price.toFixed(2),
          currency: 'USD',
          receiver: `${merchant} (Cambodian Retail Merchant)`,
          date: new Date().toLocaleString(),
          type: 'KHQR_PAY',
          fee: 'No Fee'
        });

        setActiveSubScreen('receipt');
      });
    }, 1000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
      
      {/* Simulation Info & Control Panel Side (Desktop visible, excellent interactive tool) */}
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <span className="text-[10px] uppercase font-bold text-blue-600 font-mono tracking-widest block leading-none">
            ACLEDA Mobile UX Showcase
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">
            {t.simPanel}
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {t.simDesc} កម្មវិធីនេះចម្លងការរចនា និងបទពិសោធន៍ប្រើប្រាស់របស់កម្មវិធី <strong className="text-blue-600">អេស៊ីលីដាទាន់ចិត្ត (ACLEDA Mobile)</strong> ជំនាន់ចុងក្រោយបង្អស់ ដោយភ្ជាប់ជាមួយប្រព័ន្ធទិន្នន័យ (Balances, Transaction Streams, Receipts) សកម្ម។
          </p>
        </div>

        {/* Informative Instructions */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-2 text-slate-600">
          <p className="font-bold text-slate-800 flex items-center gap-1.5 text-blue-700">
            <Info size={14} />
            ការសាកល្បងមុខងារផ្សេងៗ (Demo Flows):
          </p>
          <ul className="list-disc pl-4 space-y-1.5 leading-normal">
            <li><strong>បញ្ចូលលុយទូរស័ព្ទ</strong>: សាកល្បងបញ្ចូលលុយ Smart, Cellcard, Metfone រួចវាយលេខកូដសាកល្បង (លេខណាក៏បាន ឬ 123456) ដើម្បីទទួបានឧបករណ៍បង្កាន់ដៃ។</li>
            <li><strong>ប្រព័ន្ធ QR ឆ្លាតវៃ</strong>: ចុចលើផ្ទាំង QR ចំកណ្តាលខាងក្រោម រួចតេស្តស្កែន (ចុចលើហាងកាហ្វេគំរូ Coffee Shop ឬ BookStore) ដើម្បីកាត់លុយ USD ក្នុងគណនីភ្លាមៗ។</li>
            <li><strong>គណនីបង្រៀន (Chbar Chroh School)</strong>: ជ្រើសរើស <em>បង់ប្រាក់</em> រួចបង់ថ្លៃសាលាគំរូ <strong>"សាលាសហគមន៍ច្បារច្រុះ"</strong> ដើម្បីផ្សារភ្ជាប់ជាមួយសាលារបស់អ្នក!</li>
          </ul>
        </div>

        {/* Simulator controls buttons */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">សកម្មភាពគណនី (Simulated Injectors)</h4>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setBalanceUSD(prev => prev + 100);
                alert(lang === 'kh' ? 'បានបញ្ចូល $100 USD!' : 'Injected $100.00 USD successfully!');
              }}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold text-xs border border-blue-100 text-center transition-colors font-mono"
            >
              +$100 USD
            </button>

            <button
              onClick={() => {
                setBalanceKHR(prev => prev + 500000);
                alert(lang === 'kh' ? 'បានបញ្ចូល ៥០០,០០០ KHR!' : 'Injected 500,000 KHR successfully!');
              }}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-xs border border-emerald-100 text-center transition-colors font-mono"
            >
              +500K KHR
            </button>
          </div>

          <button
            onClick={() => {
              setTransactions([]);
              alert(lang === 'kh' ? 'បានសម្អាតប្រវត្តិប្រតិបត្តិការ!' : 'Cleared simulated transactions lists!');
            }}
            className="w-full text-center px-4 py-2 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs border border-red-100 transition-colors"
          >
            {t.cleanLogs}
          </button>
        </div>

        {/* Toggle Lang */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-150">
          <span className="text-xs font-semibold text-slate-600">ភាសាដំណើរការ (Interface Language)</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border">
            <button
              onClick={() => setLang('kh')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${lang === 'kh' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-550'}`}
            >
              ខ្មែរ 🇰🇭
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-550'}`}
            >
              EN 🇬🇧
            </button>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center">
          Powered by Acleda Mobile UI Core Framework (React 19 + Tailwind v4)
        </div>
      </div>

      {/* PHONE REALISTIC CONTAINER (Right Side Laptop rendering, fills screen beautifully) */}
      <div className="lg:col-span-7 flex justify-center items-center w-full">
        <div className="relative w-full max-w-[395px] h-[780px] bg-slate-950 rounded-[48px] border-[10px] border-slate-900 shadow-2xl flex flex-col overflow-hidden text-white font-sans ring-1 ring-slate-800/10 scale-95 md:scale-100 origin-top">
          
          {/* Invisible Camera Dynamic Island Frame Overlay */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center">
            <div className="w-3 h-3 bg-[#0d0d0d] rounded-full absolute right-3" />
          </div>

          {/* Phone Status Top bar */}
          <div className="h-10 bg-[#0B1A30] px-6 pt-3 flex justify-between items-center text-[11px] font-bold tracking-tight font-mono select-none z-40">
            <span>4:37 📍</span>
            <div className="flex items-center gap-1">
              <span>📶</span>
              <span>5G</span>
              <span>🔋 77%</span>
            </div>
          </div>

          {/* ACLEDA APP CONTAINER WITH DEEP NAVY BLUE GRADIENT */}
          <div className="flex-1 bg-gradient-to-b from-[#0B1A30] via-[#0E203B] to-[#0A1729] flex flex-col relative overflow-hidden select-none pb-16">
            
            {/* CORE INTERACTIVE PAGE LAYER ROUTING */}
            <AnimatePresence mode="wait">
              
              {/* HOME SCREEN */}
              {activeSubScreen === 'home' && (
                <motion.div 
                  key="main_home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-5"
                >
                  {/* APP BRAND HEADER ROW */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      {/* ACLEDA Blue & Gold bird vector emblem */}
                      <div className="relative w-9 h-9 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/20">
                        {/* Gold bird shape SVG simulation inside */}
                        <svg viewBox="0 0 100 100" className="w-5 h-5 text-amber-400 fill-current">
                          <path d="M10 50 Q 40 20, 80 15 Q 60 45, 90 80 Q 45 60, 10 50" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold tracking-wide text-white leading-none font-serif">{t.appName}</h3>
                        <p className="text-[8px] tracking-widest text-[#94a3b8] font-bold font-mono mt-1 uppercase">{t.bankName}</p>
                      </div>
                    </div>

                    {/* Quick Notifications bell and red profile action badge */}
                    <div className="flex items-center gap-3">
                      <button className="relative p-1.5 bg-[#172A45] rounded-xl hover:bg-slate-800 text-slate-350 transition-colors">
                        <Bell size={15} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-bounce" />
                      </button>
                      <button className="w-7 h-7 bg-red-650 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm font-mono border border-red-500/10">
                        Q
                      </button>
                    </div>
                  </div>

                  {/* 3x3 CHROME KEY OPERATIONS MATRIX */}
                  <div className="grid grid-cols-3 bg-[#112239] rounded-2xl border border-slate-800/40 divide-x divide-y divide-slate-800/35 overflow-hidden shadow-md">
                    
                    {/* Pay Bills button */}
                    <button 
                      onClick={() => setActiveSubScreen('pay_bills')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
                        <Zap size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.pay}</span>
                    </button>

                    {/* Top Up button */}
                    <button 
                      onClick={() => {
                        setTopupPhone('');
                        setActiveSubScreen('topup');
                      }}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                        <Phone size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.phoneTopup}</span>
                    </button>

                    {/* Transfers button */}
                    <button 
                      onClick={() => {
                        setTransferRecipient('');
                        setTransferAccountNum('');
                        setTransferAmount(0);
                        setActiveSubScreen('transfer');
                      }}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400">
                        <ArrowLeftRight size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.transfer}</span>
                    </button>

                    {/* My Cards button */}
                    <button 
                      onClick={() => alert('Feature coming soon in full production!')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400">
                        <CreditCard size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.cards}</span>
                    </button>

                    {/* QR Pay button */}
                    <button 
                      onClick={() => setActiveSubScreen('qr_scan')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-[#10B981]/15 rounded-full flex items-center justify-center text-teal-400">
                        <ScanLine size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.qrPay}</span>
                    </button>

                    {/* Accounts Wallet view */}
                    <button 
                      onClick={() => setActiveSubScreen('accounts')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-[#3B82F6]/15 rounded-full flex items-center justify-center text-blue-300">
                        <Wallet size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.accounts}</span>
                    </button>

                    {/* Deposits / savings indicator link */}
                    <button 
                      onClick={() => alert(`Your total Deposits: USD $${balanceUSD}`)}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-fuchsia-500/10 rounded-full flex items-center justify-center text-fuchsia-400">
                        <TrendingUp size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.deposits}</span>
                    </button>

                    {/* Loans selector widget */}
                    <button 
                      onClick={() => alert('No active loans inside simulated profile.')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-450">
                        <HandCoins size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.loans}</span>
                    </button>

                    {/* Quick ATM cash withdrawals simulation */}
                    <button 
                      onClick={() => alert('Please scan ACLEDA QR ATM to withdraw cash!')}
                      className="p-3.5 flex flex-col items-center justify-center text-center hover:bg-[#1A2E4B] transition-colors gap-3.5 aspect-square"
                    >
                      <div className="w-9 h-9 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400">
                        <DollarSign size={18} />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-100 tracking-tight leading-tight block">{t.quickCash}</span>
                    </button>

                  </div>

                  {/* HORIZONTAL SWIPABLE AD BANNERS CAROUSEL */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-slate-450 font-serif lowercase">ACLEDA Exclusive Promos</span>
                      <span className="text-[8px] px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full font-mono uppercase">2 Active</span>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1 invisible-scrollbar scroll-smooth snap-x snap-mandatory">
                      
                      {/* Purple Loyalty card */}
                      <div className="min-w-full bg-gradient-to-r from-violet-600 via-indigo-700 to-blue-800 p-4 rounded-2xl flex items-center justify-between gap-4 snap-center relative overflow-hidden shadow border border-indigo-500/15">
                        <div className="space-y-1 z-10 flex-1">
                          <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{t.myPoints}</span>
                          <p className="text-[10px] font-medium leading-relaxed text-slate-200 mt-2">{t.pointsDesc}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner shrink-0 z-10">
                          🏆
                        </div>
                        {/* Decorative bubbles */}
                        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-500/30 rounded-full" />
                      </div>

                      {/* Toanchet Pay corporate card */}
                      <div className="min-w-full bg-gradient-to-r from-blue-700 to-teal-800 p-4 rounded-2xl flex items-center justify-between gap-4 snap-center relative overflow-hidden shadow border border-blue-500/15">
                        <div className="space-y-1 z-10 flex-1">
                          <span className="text-[9px] bg-red-400/20 text-red-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{t.toanchetPay}</span>
                          <p className="text-[10px] font-medium leading-relaxed text-slate-200 mt-2">{t.toanchetdesc}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner shrink-0 z-10">
                          🏢
                        </div>
                        <div className="absolute -top-6 -left-6 w-16 h-16 bg-emerald-500/20 rounded-full" />
                      </div>

                    </div>
                  </div>

                  {/* PUBLIC SERVICES SECTOR ACORDIONS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">{t.publicServices} &gt;</h4>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      
                      {/* PPWSA water */}
                      <button 
                        onClick={() => {
                          setBillType('water');
                          setBillAmount(9.50);
                          setBillAccountNo('PPWSA-CRH-920');
                          setActiveSubScreen('pay_bills');
                        }}
                        className="flex flex-col items-center text-center space-y-1.5"
                      >
                        <div className="w-11 h-11 bg-white rounded-full border border-blue-500/10 flex items-center justify-center shadow-lg relative shrink-0">
                          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-full flex items-center justify-center text-white text-xs">
                            <Droplet size={14} fill="currentColor" />
                          </div>
                          {/* cambodian flag strip effect */}
                          <div className="absolute bottom-0 w-6 h-1.5 bg-gradient-to-r from-blue-600 via-red-500 to-blue-600 rounded-xs" />
                        </div>
                        <span className="text-[8px] font-bold text-slate-350 truncate max-w-full leading-none">PPWSA</span>
                      </button>

                      {/* EDC electricity */}
                      <button 
                        onClick={() => {
                          setBillType('electric');
                          setBillAmount(24.80);
                          setBillAccountNo('EDC-9204918');
                          setActiveSubScreen('pay_bills');
                        }}
                        className="flex flex-col items-center text-center space-y-1.5"
                      >
                        <div className="w-11 h-11 bg-white rounded-full border border-orange-500/10 flex items-center justify-center shadow-lg relative shrink-0">
                          <div className="w-9 h-9 bg-gradient-to-tr from-orange-500 to-yellow-400 rounded-full flex items-center justify-center text-white font-bold text-xs font-serif">
                            ⚡
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-350 truncate max-w-full leading-none">EDC (Power)</span>
                      </button>

                      {/* General Taxation monument logo */}
                      <button 
                        onClick={() => alert('General Taxation department integration coming soon.')}
                        className="flex flex-col items-center text-center space-y-1.5"
                      >
                        <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow p-1 shrink-0">
                          <div className="w-full h-full bg-slate-50 border border-amber-600/40 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-700">
                            🏛️
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-350 truncate max-w-full leading-none">Taxation</span>
                      </button>

                      {/* Chbar Chroh school donation */}
                      <button 
                        onClick={() => {
                          setBillType('school');
                          setBillAmount(5.00);
                          setBillAccountNo('SCH-CHBAR-048');
                          setActiveSubScreen('pay_bills');
                        }}
                        className="flex flex-col items-center text-center space-y-1.5"
                      >
                        <div className="w-11 h-11 bg-white rounded-full border border-teal-500/10 flex items-center justify-center shadow relative shrink-0">
                          <div className="w-9 h-9 bg-teal-650 rounded-full flex items-center justify-center text-white text-xs">
                            🏫
                          </div>
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">!</span>
                        </div>
                        <span className="text-[8px] font-bold rounded bg-teal-500/20 text-teal-300 px-1 py-0.5 truncate max-w-full leading-none mt-0.5">សាលារៀន</span>
                      </button>

                    </div>
                  </div>

                  {/* OTHER BUSINESS SERVICES GRID */}
                  <div className="space-y-3 pb-4">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">{t.otherServices} &gt;</h4>
                    <div className="grid grid-cols-4 gap-3">
                      
                      <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-sm shadow">
                          ☕
                        </div>
                        <span className="text-[8px] font-bold text-[#94a3b8]">Food/Cafe</span>
                      </div>

                      <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-sm shadow">
                          🛍️
                        </div>
                        <span className="text-[8px] font-bold text-[#94a3b8]">Express Go</span>
                      </div>

                      <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-sm shadow">
                          🎮
                        </div>
                        <span className="text-[8px] font-bold text-[#94a3b8]">My Play</span>
                      </div>

                      <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-sm shadow">
                          🚲
                        </div>
                        <span className="text-[8px] font-bold text-[#94a3b8]">Transport</span>
                      </div>

                    </div>
                  </div>

                </motion.div>
              )}

              {/* PHONE TOP-UP SUBCREEN */}
              {activeSubScreen === 'topup' && (
                <motion.div 
                  key="topup_screen"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <button 
                      onClick={() => setActiveSubScreen('home')}
                      className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h3 className="text-sm font-bold">{t.phoneTopup}</h3>
                  </div>

                  {/* Telecom brand selectors */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">ជ្រើសរើសប្រព័ន្ធទូរស័ព្ទ / Carrier</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'smart', name: 'Smart', desc: '096 / 010', color: 'bg-green-600/25 border-green-500/50 text-green-300' },
                        { id: 'cellcard', name: 'Cellcard', desc: '012 / 077', color: 'bg-orange-600/25 border-orange-500/50 text-orange-300' },
                        { id: 'metfone', name: 'Metfone', desc: '097 / 088', color: 'bg-red-600/25 border-red-500/50 text-red-300' }
                      ].map(tel => (
                        <button
                          key={tel.id}
                          onClick={() => setTelecomCompany(tel.id as any)}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            telecomCompany === tel.id 
                              ? tel.color + ' ring-2 ring-blue-500/50 font-bold' 
                              : 'bg-[#112239] border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="text-xs block font-bold">{tel.name}</span>
                          <span className="text-[8px] font-mono text-slate-400">{tel.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone input fields */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">{t.phoneNum}</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pl-1 font-mono">
                        🇰🇭 (+855)
                      </div>
                      <input 
                        type="tel"
                        value={topupPhone}
                        onChange={(e) => setTopupPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="96455212"
                        className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2.5 pl-24 pr-4 text-xs font-bold text-white font-mono outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Amount select buttons */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">{t.amount} (USD)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 5, 10, 20, 50].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setTopupAmount(amt)}
                          className={`p-2.5 rounded-xl border font-bold font-mono transition-all text-xs ${
                            topupAmount === amt
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                              : 'bg-[#112239] border-slate-800 text-slate-300 hover:bg-slate-800/20'
                          }`}
                        >
                          ${amt}.00
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wallet balances readout */}
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-350">
                    <span>{t.walletBal} (USD):</span>
                    <span className="font-mono font-bold text-blue-400">${balanceUSD.toFixed(2)}</span>
                  </div>

                  {/* Submit payload button */}
                  <button
                    onClick={executeTopup}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:translate-y-0.5"
                  >
                    {t.payNow} (${topupAmount.toFixed(2)} USD)
                  </button>

                </motion.div>
              )}

              {/* PHONE TRANSFER SUBCREEN */}
              {activeSubScreen === 'transfer' && (
                <motion.div 
                  key="transfer_screen"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <button 
                      onClick={() => setActiveSubScreen('home')}
                      className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h3 className="text-sm font-bold">{t.transfer}</h3>
                  </div>

                  {/* Recipient Account Name */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{t.nameOfRecipient}</label>
                    <input 
                      type="text"
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      placeholder="e.g. SOK SOPHA"
                      className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Recipient ACLEDA Account num */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{t.recipientNum}</label>
                    <input 
                      type="text"
                      value={transferAccountNum}
                      onChange={(e) => setTransferAccountNum(e.target.value.replace(/\D/g, ''))}
                      placeholder="000192482 or Phone Number"
                      className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 px-3 text-xs font-mono font-bold text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Currency selector toggle */}
                  <div className="flex items-center justify-between bg-slate-900/30 p-1 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-medium text-slate-400 pl-2">ជ្រើសរើសរូបិយប័ណ្ណ (Currency)</span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setTransferCurrency('USD')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${transferCurrency === 'USD' ? 'bg-blue-600 text-white shadow' : 'text-slate-450'}`}
                      >
                        USD ($)
                      </button>
                      <button
                        onClick={() => setTransferCurrency('KHR')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${transferCurrency === 'KHR' ? 'bg-blue-600 text-white shadow' : 'text-slate-450'}`}
                      >
                        KHR (៛)
                      </button>
                    </div>
                  </div>

                  {/* Amount Value */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{t.amount}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400 font-mono">
                        {transferCurrency === 'USD' ? '$' : '៛'}
                      </span>
                      <input 
                        type="number"
                        value={transferAmount || ''}
                        onChange={(e) => setTransferAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 pl-7 pr-3 text-xs font-mono font-bold text-white outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{t.remarks}</label>
                    <textarea 
                      value={transferRemark}
                      onChange={(e) => setTransferRemark(e.target.value)}
                      placeholder="Enter details..."
                      rows={2}
                      className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>

                  {/* Balance displays */}
                  <div className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-350">
                    <span>សមតុល្យគណនី៖</span>
                    <span className="font-mono font-bold text-blue-400">
                      {transferCurrency === 'USD' ? `$${balanceUSD.toFixed(2)}` : `${balanceKHR.toLocaleString()} KHR`}
                    </span>
                  </div>

                  <button
                    onClick={executeTransfer}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow active:translate-y-0.5"
                  >
                    {t.confirm}
                  </button>

                </motion.div>
              )}

              {/* PAY UTILITY BILLS SUBCREEN */}
              {activeSubScreen === 'pay_bills' && (
                <motion.div 
                  key="pay_bills_screen"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <button 
                      onClick={() => setActiveSubScreen('home')}
                      className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h3 className="text-xs font-bold">{t.billPayment}</h3>
                  </div>

                  {/* Bill Type Radio selectors */}
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-widest">ជ្រើសរើសប្រភេទសេវា (Utility Category)</label>
                    <div className="space-y-2">
                      {[
                        { id: 'school', title: t.schoolUtility, billNo: 'SCH-CHBAR-048', amount: 5.00, icon: '🏫', color: 'border-teal-500/20 bg-teal-500/5 text-teal-300' },
                        { id: 'electric', title: t.electricityUtility, billNo: 'EDC-9204918', amount: 24.80, icon: '⚡', color: 'border-orange-500/20 bg-orange-500/5 text-orange-300' },
                        { id: 'water', title: t.waterUtility, billNo: 'PPWSA-CRH-920', amount: 9.50, icon: '💧', color: 'border-blue-500/20 bg-blue-500/5 text-blue-300' }
                      ].map(bill => (
                        <button
                          key={bill.id}
                          onClick={() => {
                            setBillType(bill.id as any);
                            setBillAccountNo(bill.billNo);
                            setBillAmount(bill.amount);
                          }}
                          className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${
                            billType === bill.id 
                              ? bill.color + ' ring-1.5 ring-blue-500' 
                              : 'bg-[#112239] border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{bill.icon}</span>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold block truncate">{bill.title}</span>
                              <span className="text-[9px] font-mono text-slate-400">Account No: {bill.billNo}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-right text-blue-400 tracking-tight shrink-0">
                            ${bill.amount.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input details overrides */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">លេខកូដវិក្កយបត្រ (Invoice / Account Number)</label>
                    <input 
                      type="text"
                      value={billAccountNo}
                      onChange={(e) => setBillAccountNo(e.target.value)}
                      className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 px-3 text-xs font-mono font-bold text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">ចំនួនទឹកប្រាក់បង (Bill Amount USD)</label>
                    <input 
                      type="number"
                      value={billAmount || ''}
                      onChange={(e) => setBillAmount(Number(e.target.value))}
                      className="w-full bg-[#112239] border border-slate-800 rounded-xl py-2 px-3 text-xs font-mono font-bold text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-350">
                    <span>សមតុល្យ USD របស់អ្នក៖</span>
                    <span className="font-mono font-bold text-blue-400">${balanceUSD.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={executeBillPayment}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow active:translate-y-0.5"
                  >
                    {t.payNow}
                  </button>

                </motion.div>
              )}

              {/* PHONE ACCOUNTS WALLET DATA READOUT */}
              {activeSubScreen === 'accounts' && (
                <motion.div 
                  key="accounts_screen"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setActiveSubScreen('home')}
                        className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="text-sm font-bold">{t.accounts}</h3>
                    </div>
                    {/* Hider toggle */}
                    <button
                      onClick={() => setShowBalance(!showBalance)}
                      className="p-1.5 hover:bg-[#1E3048] text-slate-400 rounded-lg transition-all"
                    >
                      {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Elegant Bank Cards rendering */}
                  <div className="bg-gradient-to-tr from-[#1E293B] via-[#0E203B] to-[#122C54] p-5 rounded-2xl border border-slate-750/30 shadow-md space-y-5 relative overflow-hidden">
                    
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 font-serif leading-none tracking-wide block uppercase">ACLEDA Savings Acc</span>
                        <h4 className="text-sm font-bold font-mono tracking-wider mt-1">SOK VIBOL (គ្រូបង្រៀន)</h4>
                      </div>
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-mono font-bold">Primary</span>
                    </div>

                    <div className="pt-2 relative z-10">
                      <span className="text-[10px] text-slate-450 block uppercase tracking-wider">{t.walletBal}</span>
                      <div className="space-y-1 mt-1 font-mono">
                        <p className="text-lg font-bold text-white tracking-wide">
                          {showBalance ? formatAmount(balanceUSD, 'USD') : '•••••• USD'}
                        </p>
                        <p className="text-xs text-slate-300">
                          {showBalance ? formatAmount(balanceKHR, 'KHR') : '•••••• KHR'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono relative z-10 pt-2 border-t border-slate-800/60">
                      <span>Acc No: 1049-0149-1824</span>
                      <span>CVV: 508</span>
                    </div>

                    <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-[#0B66C2]/10 rounded-full" />
                  </div>

                  {/* Transaction history logs inline */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 block">ប្រវត្តិប្រតិបត្តិការណ៍ចុងក្រោយ / Recent Ledger</h4>
                    <div className="space-y-2">
                      {transactions.map(txn => (
                        <div key={txn.id} className="p-3 bg-[#112239] border border-slate-800/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0">
                              {txn.logoType === 'phone' ? '📱' : txn.logoType === 'transfer' ? '💸' : txn.logoType === 'utility' ? '⚡' : '💰'}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-200 block truncate">{txn.type}</span>
                              <span className="text-[9px] text-slate-455 block truncate">{txn.description}</span>
                            </div>
                          </div>
                          
                          <div className="text-right font-mono shrink-0">
                            <span className={`font-semibold ${txn.type.includes('ចូល') || txn.type.includes('salary') ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {txn.type.includes('ចូល') || txn.type.includes('salary') ? '+' : '-'} {formatAmount(parseFloat(txn.amount.replace(/,/g, '')), txn.currency)}
                            </span>
                            <span className="text-[8px] text-slate-450 block">{txn.date}</span>
                          </div>
                        </div>
                      ))}

                      {transactions.length === 0 && (
                        <p className="text-center text-slate-500 py-6 text-xs italic">មិនទាន់មានប្រតិបត្តិការថ្មីៗនៅឡើយទេ</p>
                      )}
                    </div>
                  </div>

                </motion.div>
              )}

              {/* PHONE KHQR SCANNER VIEW */}
              {activeSubScreen === 'qr_scan' && (
                <motion.div 
                  key="qr_scan_screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col justify-between p-6 text-center space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-left">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setActiveSubScreen('home')}
                        className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="text-xs font-bold">{t.qrPay}</h3>
                    </div>
                    {/* Toggle show my QR */}
                    <button
                      onClick={() => setActiveSubScreen('my_qr')}
                      className="text-[9px] font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded"
                    >
                      My QR Code
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-normal">
                    {t.scanNotice}
                  </p>

                  {/* Mock animated camera scanner frame */}
                  <div className="relative w-56 h-56 mx-auto bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-inner p-4 select-none">
                    
                    {/* Corner Reticle brackets */}
                    <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-blue-500 rounded-tl-md" />
                    <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-blue-500 rounded-tr-md" />
                    <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-blue-500 rounded-bl-md" />
                    <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-blue-500 rounded-br-md" />

                    {/* Animated glowing scanning laser line */}
                    <div className="w-full h-0.5 bg-blue-500/80 shadow-[0_0_10px_#3b82f6] absolute left-0 scan-line-animation" />

                    <div className="m-auto text-slate-600 font-bold text-[10px] uppercase font-mono z-10 flex flex-col items-center gap-2">
                      <ScanLine size={32} className="text-slate-500/60 animate-pulse" />
                      <span>Scanning KHQR...</span>
                    </div>

                  </div>

                  {/* Quick-tap sample QR Merchants simulation */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1 block">ស្កែនម៉ាស៊ីនគំរូ / Select Dummy Shops to buy:</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePredefinedQRScan(lang === 'kh' ? 'ហាងកាហ្វេ សម្រស់ច្បារច្រុះ' : 'Chbar Chroh Organic Cafe', 3.50)}
                        className="p-2.5 bg-[#112239] border border-slate-850 hover:bg-[#1C3354] rounded-xl text-left transition-all"
                      >
                        <span className="text-xs font-bold block truncate">☕ Cafe Shop</span>
                        <span className="text-[9px] font-bold text-blue-400 font-mono mt-0.5 block">$3.50 USD</span>
                      </button>

                      <button
                        onClick={() => handlePredefinedQRScan(lang === 'kh' ? 'បណ្ណាគារ សិស្សល្អជនបទ' : 'Siss L_or Bookstore', 8.90)}
                        className="p-2.5 bg-[#112239] border border-slate-850 hover:bg-[#1C3354] rounded-xl text-left transition-all"
                      >
                        <span className="text-xs font-bold block truncate">📚 Rural Bookstore</span>
                        <span className="text-[9px] font-bold text-blue-400 font-mono mt-0.5 block">$8.90 USD</span>
                      </button>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* NEW SUB-VIEW: MY PERSONAL KHQR */}
              {activeSubScreen === 'my_qr' && (
                <motion.div 
                  key="my_qr_screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-center"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-left">
                    <button 
                      onClick={() => setActiveSubScreen('qr_scan')}
                      className="p-1 hover:bg-[#1E3048] rounded text-slate-350"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h3 className="text-xs font-bold">{t.myQrTitle}</h3>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal px-2">
                    {t.qrHint}
                  </p>

                  {/* Elegant KHQR graphics card */}
                  <div className="bg-white text-slate-800 p-5 rounded-3xl space-y-3.5 shadow-lg border border-slate-200 w-full max-w-[270px] mx-auto relative overflow-hidden">
                    
                    {/* KHQR Title border banner */}
                    <div className="bg-red-600 text-white py-1 px-3.5 rounded-full inline-block font-mono text-[9px] font-bold tracking-widest leading-none">
                      KHQR
                    </div>

                    <p className="text-xs font-bold text-slate-800 mt-1 uppercase leading-none font-mono tracking-wide">
                      SOK VIBOL
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 font-semibold leading-none">
                      1049-0149-1824 (USD)
                    </p>

                    {/* QR Code matrix visual placeholder */}
                    <div className="w-44 h-44 mx-auto border border-slate-100 p-2 rounded-xl flex items-center justify-center bg-slate-50 relative shadow-sm">
                      <QrCode size={135} className="text-slate-900" />
                      {/* ACLEDA Small overlay badge right in center */}
                      <div className="absolute w-8 h-8 rounded-full bg-blue-600 border border-slate-100/90 flex items-center justify-center font-bold text-white text-[12px] shadow shadow-slate-900/10">
                        🇰🇭
                      </div>
                    </div>

                    {/* National Emblem design decoration */}
                    <div className="text-[9px] font-bold text-slate-400 font-serif lowercase block mt-1 tracking-wider">
                      ACLEDA Mobile Instant Pay
                    </div>
                  </div>

                  <div className="flex justify-center gap-2.5">
                    <button
                      onClick={() => alert(lang === 'kh' ? 'បានរក្សាទុករូបភាព QR ក្នុងទូរស័ព្ទគំរូជោគជ័យ' : 'Saved simulated QR image asset')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-[10px] font-bold inline-flex items-center gap-1 border border-slate-700"
                    >
                      <Download size={13} />
                      Save
                    </button>
                    <button
                      onClick={() => alert(lang === 'kh' ? 'បានចែករំលែកតំណភ្ជាប់គណនី' : 'Shared KHQR payment link')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-550 text-white rounded-xl text-[10px] font-bold inline-flex items-center gap-1 shadow"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TRANSACTION RECEIPT SCREEN */}
              {activeSubScreen === 'receipt' && receiptDetails && (
                <motion.div 
                  key="receipt_screen"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
                >
                  <div className="text-center pt-2 space-y-2">
                    <div className="w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/30">
                      <CheckCircle2 size={26} strokeWidth={2.5} className="animate-bounce" />
                    </div>
                    <h3 className="text-sm font-bold text-white font-serif">{receiptDetails.title}</h3>
                    <p className="text-[20px] font-mono font-bold tracking-tight text-white mt-1">
                      {receiptDetails.currency === 'USD' ? '$' : ''}{receiptDetails.amount} <span className="text-xs font-semibold">{receiptDetails.currency}</span>
                    </p>
                  </div>

                  {/* Elegant payment breakdown list card */}
                  <div className="bg-[#112239] border border-slate-800/40 divide-y divide-slate-800/40 p-4 rounded-2xl text-xs space-y-2 text-slate-300">
                    
                    <div className="flex justify-between py-1.5 font-mono">
                      <span className="text-slate-400 font-sans">{t.txnId}:</span>
                      <span className="text-white font-bold select-all">{receiptDetails.txnId}</span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">អ្នកទទួលផល / Payment For:</span>
                      <span className="text-slate-100 font-bold text-right">{receiptDetails.receiver}</span>
                    </div>

                    <div className="flex justify-between py-1.5 font-mono">
                      <span className="text-slate-400 font-sans">{t.time}:</span>
                      <span className="text-slate-300 font-medium text-right">{receiptDetails.date}</span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">{t.fee}:</span>
                      <span className="text-emerald-405 font-bold text-[#10B981]">{t.feeFree}</span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">វិធីទូទាត់ / Source:</span>
                      <span className="text-blue-400 font-bold">Primary Savings Acc</span>
                    </div>

                  </div>

                  <div className="p-3.5 bg-slate-900/30 rounded-xl border border-slate-800/60 text-[10px] text-slate-400 flex items-start gap-2 max-w-full leading-normal">
                    <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>ប្រតិបត្តិការអេឡិចត្រូនិចនេះត្រូវបានបញ្ជាក់សុវត្ថិភាពដោយធនាគារកណ្តាល និងបច្ចេកវិទ្យា ACLEDA SafeEngine។</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => alert('Saved digital receipt PDF successfully!')}
                      className="p-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold font-serif flex items-center justify-center gap-1 border border-slate-750"
                    >
                      <Download size={13} />
                      Download
                    </button>
                    <button
                      onClick={() => setActiveSubScreen('home')}
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center"
                    >
                      <Check size={13} className="mr-0.5" />
                      {t.confirm}
                    </button>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>

            {/* MPIN PASSWORD SECURE AUTH OVERLAY MODAL */}
            {showMpinModal && (
              <div className="absolute inset-0 bg-[#0B1A30]/95 z-55 flex flex-col justify-end p-6 select-none">
                <button 
                  onClick={() => setShowMpinModal(false)}
                  className="p-1 text-slate-400 hover:text-white absolute right-4 top-4"
                >
                  <X size={20} />
                </button>
                
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">លេខកូដសុវត្ថិភាព MPIN</h3>
                    <p className="text-[10px] text-slate-400 mt-2 leading-normal px-6">
                      {t.enterPin}
                    </p>
                  </div>

                  {/* Bullet visual password placeholders */}
                  <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <div 
                        key={idx} 
                        className={`w-3.5 h-3.5 rounded-full border border-blue-500/40 transition-all ${
                          mpinInput.length > idx ? 'bg-blue-500 scale-110 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-[#112239]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* MPIN Dial keyboard */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto pb-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                    <button
                      key={key}
                      onClick={() => handleMpinKeyPress(key)}
                      className="w-14 h-14 bg-[#112239] hover:bg-[#1C3354] border border-slate-800/40 text-white font-mono text-lg font-bold rounded-full flex items-center justify-center active:scale-90 transition-all shadow-sm"
                    >
                      {key}
                    </button>
                  ))}
                  
                  {/* Cancel */}
                  <button
                    onClick={() => setShowMpinModal(false)}
                    className="w-14 h-14 text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleMpinKeyPress('0')}
                    className="w-14 h-14 bg-[#112239] hover:bg-[#1C3354] border border-slate-800/40 text-white font-mono text-lg font-bold rounded-full flex items-center justify-center active:scale-90 transition-all shadow-sm"
                  >
                    0
                  </button>

                  {/* Backspace code */}
                  <button
                    onClick={handleMpinBackspace}
                    className="w-14 h-14 text-slate-400 flex items-center justify-center"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}

            {/* FIXED BOTTOM APP NAVIGATION TAB BAR */}
            <nav className="absolute bottom-0 inset-x-0 h-16 bg-[#0f213a] border-t border-slate-800/50 flex justify-between items-center px-4 z-40">
              
              {/* Home Tab */}
              <button 
                onClick={() => {
                  setReceiptDetails(null);
                  setActiveSubScreen('home');
                }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeSubScreen === 'home' ? 'text-amber-400' : 'text-slate-450'}`}
              >
                <Home size={16} />
                <span className="text-[9px] font-bold leading-none">{t.home}</span>
              </button>

              {/* History records tab */}
              <button 
                onClick={() => setActiveSubScreen('accounts')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeSubScreen === 'accounts' ? 'text-amber-400' : 'text-slate-450'}`}
              >
                <Heart size={16} />
                <span className="text-[9px] font-bold leading-none">{t.records}</span>
              </button>

              {/* Floating circular central QR Code action button */}
              <div className="relative w-14 h-14 -mt-6 z-50 shrink-0">
                <button 
                  onClick={() => setActiveSubScreen('qr_scan')}
                  className="w-12 h-12 bg-blue-600 border border-slate-700/50 text-white rounded-full flex items-center justify-center hover:bg-blue-500 shadow-lg shadow-blue-500/25 active:scale-95 transition-all outline-none"
                >
                  <QrCode size={20} />
                </button>
              </div>

              {/* Conversational Support tab */}
              <button 
                onClick={() => alert('Support line calling... Please make sure you have internet connectivity.')}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-450"
              >
                <MessageSquare size={16} />
                <span className="text-[9px] font-bold leading-none">{t.chat}</span>
              </button>

              {/* Grid Menu tab */}
              <button 
                onClick={() => alert(`ACLEDA Mobile App Version 2.0. Khmer developer template mock.`)}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-450"
              >
                <Menu size={16} />
                <span className="text-[9px] font-bold leading-none">{t.menu}</span>
              </button>

            </nav>

          </div>

        </div>
      </div>

    </div>
  );
}
