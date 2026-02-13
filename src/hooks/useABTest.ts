import { getActiveEmailAbTest, getEmailAbAssignment } from "@/integrations/azure/data";

interface ABTestResult {
  testId: string;
  variant: "A" | "B";
  subject: string;
  preview: string | null;
}

/**
 * Gets the A/B test variant for a user and notification type.
 * Assigns users consistently to the same variant using their user ID.
 */
export async function getABTestVariant(
  userId: string,
  notificationType: string
): Promise<ABTestResult | null> {
  try {
    const test = await getActiveEmailAbTest(notificationType);
    if (!test || !test.id) return null;

    const assignment = await getEmailAbAssignment(test.id as string, userId);

    let variant: "A" | "B";
    if (assignment?.variant) {
      variant = assignment.variant as "A" | "B";
    } else {
      const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      variant = hash % 2 === 0 ? "A" : "B";
    }

    return {
      testId: test.id as string,
      variant,
      subject:
        (variant === "A" ? test.variant_a_subject : test.variant_b_subject) as string,
      preview: (variant === "A"
        ? test.variant_a_preview
        : test.variant_b_preview) as string | null,
    };
  } catch (error) {
    console.error("Error getting A/B test variant:", error);
    return null;
  }
}

/**
 * Records an A/B test assignment when an email is sent.
 */
export async function recordABTestAssignment(
  testId: string,
  userId: string,
  variant: "A" | "B",
  notificationId: string
): Promise<void> {
  try {
    const { insertEmailAbAssignment } = await import("@/integrations/azure/data");
    await insertEmailAbAssignment({
      test_id: testId,
      user_id: userId,
      variant,
      notification_id: notificationId,
    });
  } catch (error) {
    console.error("Error recording A/B test assignment:", error);
  }
}
