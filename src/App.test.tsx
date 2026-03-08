import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('ChitChatTalks App - Smoke Test', () => {
  it('renders the home screen with title and input fields', () => {
    render(<App />);
    expect(screen.getByText('ChitChatTalks')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Create New Session')).toBeInTheDocument();
    expect(screen.getByText('Join Session')).toBeInTheDocument();
  });

  it('validates user name before creating a session', async () => {
    render(<App />);
    const createBtn = screen.getByText('Create New Session');
    fireEvent.click(createBtn);
    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
  });

  it('updates the name input correctly', () => {
    render(<App />);
    const nameInput = screen.getByPlaceholderText('Enter your name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(nameInput.value).toBe('Alice');
  });

  it('updates the session code input and capitalizes it', () => {
    render(<App />);
    const codeInput = screen.getByPlaceholderText('Enter session code to join') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: 'abcxyz' } });
    expect(codeInput.value).toBe('ABCXYZ');
  });
});
