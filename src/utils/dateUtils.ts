export const formatDateGerman = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseGermanDate = (dateStr: string): Date | null => {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

export const getBeginDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 3, 1);
};

export const getEndDate = (beginDate: Date): Date => {
  return new Date(beginDate.getFullYear(), beginDate.getMonth(), 0);
};

export const calculateDates = () => {
  const today = new Date();
  const beginDate = getBeginDate();
  const endDate = getEndDate(beginDate);
  
  return {
    today: formatDateGerman(today),
    todayForInput: formatDateForInput(today),
    beginDate: formatDateGerman(beginDate),
    endDate: formatDateGerman(endDate),
  };
};
