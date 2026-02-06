import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Hero } from "./Hero";

describe("Hero", () => {
	it("renders the main headline", () => {
		render(<Hero />);
		expect(
			screen.getByRole("heading", { name: /meet your matchmaker/i }),
		).toBeInTheDocument();
	});

	it("renders the new subheadline emphasizing people who know you", () => {
		render(<Hero />);
		expect(
			screen.getByText(
				/the best introductions come from people who really know you/i,
			),
		).toBeInTheDocument();
	});

	it("renders the chat demo toggle with Matchmaker and Single tabs", () => {
		render(<Hero />);
		expect(screen.getByRole("tab", { name: /matchmaker/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /single/i })).toBeInTheDocument();
	});

	it("shows Matchmaker chat demo by default", () => {
		render(<Hero />);
		expect(
			screen.getByText(/I'm here to help my friend/i),
		).toBeInTheDocument();
	});

	it("switches to Single chat demo when Single tab is clicked", async () => {
		const user = userEvent.setup();
		render(<Hero />);

		const singleTab = screen.getByRole("tab", { name: /single/i });
		await user.click(singleTab);

		expect(
			screen.getByText(/I'm looking for someone to match me/i),
		).toBeInTheDocument();
	});

	it("renders the Join the Waitlist button", () => {
		render(<Hero />);
		expect(
			screen.getByRole("button", { name: /join the waitlist/i }),
		).toBeInTheDocument();
	});
});
